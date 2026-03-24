from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.files.storage import default_storage
from django.db import models as db_models
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.utils.decorators import method_decorator
from django.conf import settings
from django_ratelimit.decorators import ratelimit
from datetime import datetime, timedelta
import resend
import os

from .serializers import UserSerializer, ProfileUpdateSerializer, TrackSerializer, PublicTrackSerializer, PublicProfileSerializer, ProjectSerializer, ProjectListSerializer, PublicationSerializer
from .models import Track, Project, Publication, Like, TrackLike

resend.api_key = os.environ.get('RESEND_API_KEY')
User = get_user_model()

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]

class LoginView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]

class ProtectedView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        return Response({"message": "This is a protected endpoint! You are authenticated."})

class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    @method_decorator(ratelimit(key='ip', rate='5/h', method='POST', block=False))
    @method_decorator(ratelimit(key='post:email', rate='5/h', method='POST', block=False))
    def post(self, request):
        # Check if rate limited
        if getattr(request, 'limited', False):
            return Response({'error': 'Too many reset attempts. Please try again later.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'message': 'If an account with this email exists, a reset link has been sent.'})

        # Generate token
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        # Build reset link
        frontend_url = settings.FRONTEND_URL  # Add this to settings.py
        reset_link = f"{frontend_url}/reset-password?uid={uid}&token={token}"

        # Send email with Resend
        # In your ForgotPasswordView, before sending the email:
        expires_at = datetime.now() + timedelta(hours=1)
        expires_formatted = expires_at.strftime("%B %d, %Y at %I:%M %p")
        resend.Emails.send({
            "from": "Sonara <noreply@support.sonara.us>",
            "to": email,
            "subject": "Reset your Sonara password",
            "html": f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
            </head>
            <body style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #1a1a2e; color: #ffffff; padding: 0; margin: 0;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #1a1a2e;">
                    <tr>
                        <td align="center" style="padding: 40px 20px;">
                            <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #1a1a2e; border-radius: 12px; padding: 40px;">
                                <tr>
                                    <td align="center">
                                        <!-- Logo -->
                                        <img src="https://www.sonara.us/sonara_logo.png" alt="Sonara" style="width: 200px; margin-bottom: 30px;" />
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center">
                                        <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 20px;">Reset Your Password</h1>
                                        <p style="color: rgba(255,255,255,0.7); font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                                            We received a request to reset your password. Click the button below to create a new one.
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center" style="padding: 20px 0;">
                                        <a href="{reset_link}" style="display: inline-block; background: linear-gradient(135deg, #00d4ff 0%, #0096c7 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                            Reset Password
                                        </a>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center">
                                        <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin-top: 20px;">
                                            This link expires on {expires_formatted}
                                        </p>
                                        <p style="color: rgba(255,255,255,0.5); font-size: 14px; margin-top: 30px;">
                                            If you didn't request this, you can safely ignore this email.
                                        </p>
                                        <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 30px 0;" />
                                        <p style="color: rgba(255,255,255,0.4); font-size: 12px;">
                                            © 2026 Sonara. All rights reserved.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """
        })

        return Response({'message': 'If an account with this email exists, a reset link has been sent.'})


class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uid = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('password')

        if not uid or not token or not new_password:
            return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response({'error': 'Invalid reset link'}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({'error': 'Invalid or expired reset link'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate password
        try:
            validate_password(new_password, user)
        except ValidationError as e:
            return Response({'error': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        return Response({'message': 'Password has been reset successfully'})

class ProfileView(RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    queryset = User.objects.all()

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return ProfileUpdateSerializer
        return UserSerializer

    def get_object(self):
        return self.request.user

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', True)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(instance, context=self.get_serializer_context()).data)


class TrackListCreateView(generics.ListCreateAPIView):
    """List the authenticated user's tracks or upload a new one."""
    serializer_class = TrackSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return Track.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save()
        user = self.request.user
        if not user.is_creator:
            user.is_creator = True
            user.save(update_fields=['is_creator'])


class TrackUpdateDeleteView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete a track (only if the requesting user owns it)."""
    serializer_class = TrackSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return Track.objects.filter(user=self.request.user)

    def perform_destroy(self, instance):
        if instance.audio_file:
            default_storage.delete(instance.audio_file.name)
        instance.delete()


# ═══════════════════════════════════════════
# Project endpoints (save/load DAW state)
# ═══════════════════════════════════════════

class ProjectListCreateView(generics.ListCreateAPIView):
    """List user's projects (lightweight) or create a new one."""
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return ProjectListSerializer
        return ProjectSerializer

    def get_queryset(self):
        return Project.objects.filter(user=self.request.user)


class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete a specific project."""
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Project.objects.filter(user=self.request.user)


# ═══════════════════════════════════════════
# Publication endpoints (public songs)
# ═══════════════════════════════════════════

class PublicationListCreateView(generics.ListCreateAPIView):
    """List user's own publications or create (publish) a new one."""
    serializer_class = PublicationSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return Publication.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save()
        user = self.request.user
        if not user.is_creator:
            user.is_creator = True
            user.save(update_fields=['is_creator'])


class PublicationUpdateDeleteView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete a publication (only if owner)."""
    serializer_class = PublicationSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return Publication.objects.filter(user=self.request.user)

    def perform_destroy(self, instance):
        if instance.audio_file:
            default_storage.delete(instance.audio_file.name)
        if instance.cover_image:
            default_storage.delete(instance.cover_image.name)
        instance.delete()


class PublicTracksView(generics.ListAPIView):
    """List all tracks from all users, newest first. Public, no auth required."""
    serializer_class = PublicTrackSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Track.objects.select_related('user').all()


class TrackDetailView(generics.RetrieveAPIView):
    """Get details of a single track. Public."""
    queryset = Track.objects.select_related('user').all()
    serializer_class = PublicTrackSerializer
    permission_classes = [permissions.AllowAny]


class PublicFeedView(generics.ListAPIView):
    """Public feed — list all published songs (no auth required)."""
    serializer_class = PublicationSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Publication.objects.filter(is_public=True)


class PublicationDetailView(generics.RetrieveAPIView):
    """Get details of a single publication. Public."""
    queryset = Publication.objects.filter(is_public=True)
    serializer_class = PublicationSerializer
    permission_classes = [permissions.AllowAny]


class UserPublicationsView(generics.ListAPIView):
    """View a specific user's public publications (no auth required)."""
    serializer_class = PublicationSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        username = self.kwargs.get('username')
        return Publication.objects.filter(user__username=username, is_public=True)


class PublicationPlayView(APIView):
    """Increment play count for a publication."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk):
        try:
            pub = Publication.objects.get(pk=pk, is_public=True)
            pub.play_count = db_models.F('play_count') + 1
            pub.save(update_fields=['play_count'])
            return Response({'status': 'ok'})
        except Publication.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


class PublicUserProfileView(APIView):
    """View any user's public profile and their tracks by username. No auth required."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, username):
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        ctx = {'request': request}
        profile_data = PublicProfileSerializer(user, context=ctx).data
        tracks = Track.objects.filter(user=user)
        profile_data['tracks'] = PublicTrackSerializer(tracks, many=True, context=ctx).data
        return Response(profile_data)


def _strip_accents(text):
    """Remove diacritics/accents: ë→e, é→e, ñ→n, etc."""
    import unicodedata
    nfkd = unicodedata.normalize('NFKD', text)
    return ''.join(c for c in nfkd if not unicodedata.combining(c)).lower()


def _fuzzy_match(haystack, needle_words):
    """Check if every needle word appears in the accent-stripped haystack."""
    h = _strip_accents(haystack)
    return all(_strip_accents(w) in h for w in needle_words)


class SearchView(APIView):
    """Unified search across users, tracks, and publications. Public, no auth required.
    Splits the query into words and does accent-insensitive matching."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({'users': [], 'tracks': [], 'publications': []})

        words = query.split()

        # Build a loose DB filter using the first word to narrow candidates,
        # then do precise accent-insensitive filtering in Python.
        first = words[0] if words else ''

        user_candidates = User.objects.filter(
            db_models.Q(username__icontains=first) |
            db_models.Q(bio__icontains=first)
        )[:100]
        users = [
            u for u in user_candidates
            if _fuzzy_match(u.username + ' ' + (u.bio or ''), words)
        ][:10]

        track_candidates = Track.objects.filter(
            db_models.Q(title__icontains=first) |
            db_models.Q(user__username__icontains=first)
        ).select_related('user')[:200]
        tracks = [
            t for t in track_candidates
            if _fuzzy_match(t.title + ' ' + t.user.username, words)
        ][:30]

        pub_candidates = Publication.objects.filter(
            db_models.Q(is_public=True) & (
                db_models.Q(title__icontains=first) |
                db_models.Q(description__icontains=first) |
                db_models.Q(user__username__icontains=first)
            )
        ).select_related('user')[:200]
        pubs = [
            p for p in pub_candidates
            if _fuzzy_match(p.title + ' ' + (p.description or '') + ' ' + p.user.username, words)
        ][:30]

        ctx = {'request': request}
        return Response({
            'users': PublicProfileSerializer(users, many=True, context=ctx).data,
            'tracks': PublicTrackSerializer(tracks, many=True, context=ctx).data,
            'publications': PublicationSerializer(pubs, many=True, context=ctx).data,
        })


# ═══════════════════════════════════════════
# Like / Library endpoints
# ═══════════════════════════════════════════

class ToggleLikeView(APIView):
    """Toggle like on a publication. Returns new like state and count."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            pub = Publication.objects.get(pk=pk, is_public=True)
        except Publication.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        like, created = Like.objects.get_or_create(user=request.user, publication=pub)
        if created:
            # Liked
            pub.like_count = db_models.F('like_count') + 1
            pub.save(update_fields=['like_count'])
            pub.refresh_from_db()
            return Response({'liked': True, 'like_count': pub.like_count})
        else:
            # Unlike
            like.delete()
            pub.like_count = db_models.F('like_count') - 1
            pub.save(update_fields=['like_count'])
            pub.refresh_from_db()
            return Response({'liked': False, 'like_count': pub.like_count})


class LibraryView(APIView):
    """List the authenticated user's liked publications and tracks (personal library)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ctx = {'request': request}

        # Liked publications
        liked_pub_ids = Like.objects.filter(
            user=request.user
        ).values_list('publication_id', flat=True)
        pubs = Publication.objects.filter(
            id__in=liked_pub_ids, is_public=True
        ).select_related('user')

        # Liked tracks
        liked_track_ids = TrackLike.objects.filter(
            user=request.user
        ).values_list('track_id', flat=True)
        tracks = Track.objects.filter(
            id__in=liked_track_ids
        ).select_related('user')

        return Response({
            'publications': PublicationSerializer(pubs, many=True, context=ctx).data,
            'tracks': PublicTrackSerializer(tracks, many=True, context=ctx).data,
        })


class TrackPlayView(APIView):
    """Increment play count for a track."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk):
        try:
            track = Track.objects.get(pk=pk)
            track.play_count = db_models.F('play_count') + 1
            track.save(update_fields=['play_count'])
            return Response({'status': 'ok'})
        except Track.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


class ToggleTrackLikeView(APIView):
    """Toggle like on a track. Returns new like state and count."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            track = Track.objects.get(pk=pk)
        except Track.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        like, created = TrackLike.objects.get_or_create(user=request.user, track=track)
        if created:
            track.like_count = db_models.F('like_count') + 1
            track.save(update_fields=['like_count'])
            track.refresh_from_db()
            return Response({'liked': True, 'like_count': track.like_count})
        else:
            like.delete()
            track.like_count = db_models.F('like_count') - 1
            track.save(update_fields=['like_count'])
            return Response({'liked': False, 'like_count': track.like_count})


# ═══════════════════════════════════════════
# Home Page Content Endpoints
# ═══════════════════════════════════════════

class TrendingTracksView(APIView):
    """Returns top 10 Tracks and Publications ranked by play count."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        ctx = {'request': request}
        
        # Get top 10 tracks by play_count
        top_tracks = Track.objects.order_by('-play_count')[:10]
        # Get top 10 public publications by play_count
        top_pubs = Publication.objects.filter(is_public=True).order_by('-play_count')[:10]

        return Response({
            'tracks': PublicTrackSerializer(top_tracks, many=True, context=ctx).data,
            'publications': PublicationSerializer(top_pubs, many=True, context=ctx).data,
        })


class NewReleasesView(APIView):
    """Returns 10 most recently uploaded Tracks and Publications."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        ctx = {'request': request}

        # Get 10 newest tracks
        new_tracks = Track.objects.order_by('-uploaded_at')[:10]
        # Get 10 newest public publications
        new_pubs = Publication.objects.filter(is_public=True).order_by('-published_at')[:10]

        return Response({
            'tracks': PublicTrackSerializer(new_tracks, many=True, context=ctx).data,
            'publications': PublicationSerializer(new_pubs, many=True, context=ctx).data,
        })