from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.files.storage import default_storage
from .models import (
    Track,
    TrackRepost,
    Project,
    Publication,
    Like,
    TrackLike,
    Notification,
    ContentComment,
    ContentCommentLike,
)

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    role = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'password',
            'is_listener', 'is_creator', 'role',
            'header_image', 'profile_picture',
            'bio', 'display_name',
        )

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user


def coerce_bool(value):
    """Accept string 'true'/'false' from multipart form data."""
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower().strip() in ('true', '1', 'yes', 'on')
    return bool(value)


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """PATCH profile: bio, roles, header_image, profile_picture, display_name, username."""
    remove_header_image = serializers.BooleanField(write_only=True, required=False, default=False)
    remove_profile_picture = serializers.BooleanField(write_only=True, required=False, default=False)
    is_listener = serializers.BooleanField(required=False, default=False)
    is_creator = serializers.BooleanField(required=False, default=False)
    username = serializers.CharField(required=False, min_length=3, max_length=30)
    display_name = serializers.CharField(required=False, allow_blank=True, max_length=100)

    class Meta:
        model = User
        fields = (
            'bio', 'is_listener', 'is_creator',
            'header_image', 'profile_picture',
            'remove_header_image', 'remove_profile_picture',
            'username', 'display_name',
        )

    def validate_username(self, value):
        import re
        value = value.strip().lower()
        if not re.match(r'^[a-z0-9_]+$', value):
            raise serializers.ValidationError(
                'Handle can only contain lowercase letters, numbers, and underscores.'
            )
        if User.objects.exclude(pk=self.instance.pk).filter(username=value).exists():
            raise serializers.ValidationError('This handle is already taken.')
        return value

    def validate_is_listener(self, value):
        return coerce_bool(value)

    def validate_is_creator(self, value):
        return coerce_bool(value)

    def validate_remove_header_image(self, value):
        return coerce_bool(value)

    def validate_remove_profile_picture(self, value):
        return coerce_bool(value)

    def update(self, instance, validated_data):
        remove_header = validated_data.pop('remove_header_image', False)
        remove_pfp = validated_data.pop('remove_profile_picture', False)

        old_header_name = instance.header_image.name if instance.header_image else None
        old_pfp_name = instance.profile_picture.name if instance.profile_picture else None

        if remove_header and instance.header_image:
            instance.header_image = None
        if remove_pfp and instance.profile_picture:
            instance.profile_picture = None

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        # Delete old files from storage when replaced or removed
        if old_header_name:
            new_header_name = instance.header_image.name if instance.header_image else None
            if new_header_name != old_header_name:
                default_storage.delete(old_header_name)
        if old_pfp_name:
            new_pfp_name = instance.profile_picture.name if instance.profile_picture else None
            if new_pfp_name != old_pfp_name:
                default_storage.delete(old_pfp_name)

        return instance


ALLOWED_AUDIO_TYPES = {
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
    'audio/ogg', 'audio/flac', 'audio/aac', 'audio/mp4',
    'audio/x-m4a', 'audio/webm',
}

AUDIO_MAX_SIZE = 50 * 1024 * 1024  # 50 MB


class TrackSerializer(serializers.ModelSerializer):
    audio_file = serializers.FileField()
    is_liked = serializers.SerializerMethodField()
    is_reposted = serializers.SerializerMethodField()

    class Meta:
        model = Track
        fields = (
            'id',
            'title',
            'audio_file',
            'cover_image',
            'uploaded_at',
            'play_count',
            'like_count',
            'repost_count',
            'is_liked',
            'is_reposted',
            'price',
            'for_sale',
        )
        read_only_fields = (
            'id',
            'uploaded_at',
            'play_count',
            'like_count',
            'repost_count',
            'is_liked',
            'is_reposted',
        )

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return TrackLike.objects.filter(user=request.user, track=obj).exists()
        return False

    def get_is_reposted(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return TrackRepost.objects.filter(user=request.user, track=obj).exists()
        return False

    def to_internal_value(self, data):
        # Coerce 'true'/'false' strings from multipart for boolean fields
        # Avoid data.copy() -- deepcopy fails on file uploads in Python 3.14
        if hasattr(data, '_mutable'):
            data._mutable = True
        if 'for_sale' in data:
            data['for_sale'] = coerce_bool(data.get('for_sale'))
        return super().to_internal_value(data)

    def validate_audio_file(self, value):
        if value.content_type not in ALLOWED_AUDIO_TYPES:
            raise serializers.ValidationError(
                'Unsupported audio format. Allowed: MP3, WAV, OGG, FLAC, AAC, M4A, WebM.'
            )
        if value.size > AUDIO_MAX_SIZE:
            raise serializers.ValidationError('Audio file must be under 50 MB.')
        return value

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class PublicProfileSerializer(serializers.ModelSerializer):
    """Public-facing user profile (no email, no password)."""
    role = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = ('id', 'username', 'role', 'is_listener', 'is_creator',
                  'header_image', 'profile_picture', 'bio', 'display_name')
        read_only_fields = fields


class PublicTrackSerializer(serializers.ModelSerializer):
    """Public-facing track serializer with uploader info for search results."""
    username = serializers.CharField(source='user.username', read_only=True)
    display_name = serializers.CharField(source='user.display_name', read_only=True)
    profile_picture = serializers.ImageField(source='user.profile_picture', read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_reposted = serializers.SerializerMethodField()

    class Meta:
        model = Track
        fields = (
            'id',
            'title',
            'audio_file',
            'cover_image',
            'uploaded_at',
            'play_count',
            'like_count',
            'repost_count',
            'username',
            'display_name',
            'profile_picture',
            'is_liked',
            'is_reposted',
            'price',
            'for_sale',
        )
        read_only_fields = fields

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return TrackLike.objects.filter(user=request.user, track=obj).exists()
        return False

    def get_is_reposted(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return TrackRepost.objects.filter(user=request.user, track=obj).exists()
        return False


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ('id', 'name', 'data', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class ProjectListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing projects (no data payload)."""
    class Meta:
        model = Project
        fields = ('id', 'name', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')


class PublicationSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    display_name = serializers.CharField(source='user.display_name', read_only=True, default='')
    profile_picture = serializers.ImageField(source='user.profile_picture', read_only=True)
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = Publication
        fields = (
            'id', 'title', 'description', 'audio_file', 'cover_image',
            'is_public', 'play_count', 'like_count', 'published_at',
            'project', 'username', 'display_name', 'profile_picture', 'is_liked', 'price', 'for_sale',
        )
        read_only_fields = ('id', 'play_count', 'like_count', 'published_at', 'username', 'display_name', 'profile_picture', 'is_liked')

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return Like.objects.filter(user=request.user, publication=obj).exists()
        return False

    def to_internal_value(self, data):
        if hasattr(data, '_mutable'):
            data._mutable = True
        if 'for_sale' in data:
            data['for_sale'] = coerce_bool(data.get('for_sale'))
        return super().to_internal_value(data)

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class ContentCommentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    display_name = serializers.CharField(source='user.display_name', read_only=True, default='')
    profile_picture = serializers.ImageField(source='user.profile_picture', read_only=True)
    like_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = ContentComment
        fields = (
            'id',
            'body',
            'created_at',
            'parent_id',
            'username',
            'display_name',
            'profile_picture',
            'like_count',
            'is_liked',
        )
        read_only_fields = (
            'id',
            'created_at',
            'parent_id',
            'username',
            'display_name',
            'profile_picture',
            'like_count',
            'is_liked',
        )

    def get_like_count(self, obj):
        v = getattr(obj, 'like_count', None)
        if v is not None:
            return v
        return obj.comment_likes.count()

    def get_is_liked(self, obj):
        v = getattr(obj, 'is_liked', None)
        if v is not None:
            return bool(v)
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return ContentCommentLike.objects.filter(comment_id=obj.pk, user_id=request.user.id).exists()


class ContentCommentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentComment
        fields = ('body', 'parent_id')

    def validate_body(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('Comment cannot be empty.')
        if len(value) > 500:
            raise serializers.ValidationError('Comment must be 500 characters or less.')
        return value


class NotificationSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    sender_display_name = serializers.CharField(source='sender.display_name', read_only=True)
    sender_profile_picture = serializers.ImageField(source='sender.profile_picture', read_only=True)
    track_title = serializers.CharField(source='track.title', read_only=True, default=None)
    track_id = serializers.IntegerField(source='track.id', read_only=True, default=None)
    publication_title = serializers.CharField(source='publication.title', read_only=True, default=None)
    publication_id = serializers.IntegerField(source='publication.id', read_only=True, default=None)

    class Meta:
        model = Notification
        fields = (
            'id', 'notification_type', 'is_read', 'created_at',
            'sender_username', 'sender_display_name', 'sender_profile_picture',
            'track_title', 'track_id', 'publication_title', 'publication_id',
            'amount',
        )
        read_only_fields = fields