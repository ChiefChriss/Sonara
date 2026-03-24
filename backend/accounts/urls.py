from django.urls import path
from .views import (
    RegisterView, LoginView, ProtectedView, ProfileView,
    ForgotPasswordView, ResetPasswordView,
    TrackListCreateView, TrackUpdateDeleteView, SearchView,
    PublicUserProfileView, PublicTracksView, TrackDetailView,
    ProjectListCreateView, ProjectDetailView,
    PublicationListCreateView, PublicationUpdateDeleteView,
    PublicFeedView, PublicationDetailView, UserPublicationsView, PublicationPlayView,
    ToggleLikeView, LibraryView,
    TrackPlayView, ToggleTrackLikeView,
    TrendingTracksView, NewReleasesView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('protected-endpoint/', ProtectedView.as_view(), name='protected-endpoint'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),
    path('tracks/', TrackListCreateView.as_view(), name='track-list-create'),
    path('tracks/<int:pk>/', TrackUpdateDeleteView.as_view(), name='track-delete'),
    path('tracks/<int:pk>/play/', TrackPlayView.as_view(), name='track-play'),
    path('tracks/<int:pk>/like/', ToggleTrackLikeView.as_view(), name='track-like'),

    # DAW projects
    path('projects/', ProjectListCreateView.as_view(), name='project-list-create'),
    path('projects/<int:pk>/', ProjectDetailView.as_view(), name='project-detail'),

    # Publications (user's own)
    path('publications/', PublicationListCreateView.as_view(), name='publication-list-create'),
    path('publications/<int:pk>/', PublicationUpdateDeleteView.as_view(), name='publication-delete'),
    path('publications/<int:pk>/play/', PublicationPlayView.as_view(), name='publication-play'),
    path('publications/<int:pk>/like/', ToggleLikeView.as_view(), name='publication-like'),

    # Library (user's liked songs)
    path('library/', LibraryView.as_view(), name='library'),

    # Public endpoints (no auth required)
    path('explore/', PublicTracksView.as_view(), name='public-tracks'),
    path('tracks/<int:pk>/detail/', TrackDetailView.as_view(), name='public-track-detail'),
    path('feed/', PublicFeedView.as_view(), name='public-feed'),
    path('publications/<int:pk>/detail/', PublicationDetailView.as_view(), name='public-publication-detail'),
    path('users/<str:username>/', PublicUserProfileView.as_view(), name='public-user-profile'),
    path('users/<str:username>/publications/', UserPublicationsView.as_view(), name='user-publications'),
    path('search/', SearchView.as_view(), name='search'),
    path('trending/', TrendingTracksView.as_view(), name='trending'),
    path('new-releases/', NewReleasesView.as_view(), name='new-releases'),
]