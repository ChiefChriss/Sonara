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
    TrackPlayView, ToggleTrackLikeView, ToggleTrackRepostView,
    UserRepostsView, FollowingRepostsView,
    TrendingTracksView, NewReleasesView,
    ToggleFollowView, FollowersListView, FollowingListView,
    NotificationListView, NotificationUnreadCountView,
    NotificationMarkReadView, NotificationMarkAllReadView,
    TrackCommentsView, PublicationCommentsView,
    TrackCommentDeleteView, PublicationCommentDeleteView,
    ToggleTrackCommentLikeView, TogglePublicationCommentLikeView,
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
    path('tracks/<int:pk>/repost/', ToggleTrackRepostView.as_view(), name='track-repost'),
    path('following-reposts/', FollowingRepostsView.as_view(), name='following-reposts'),
    path('tracks/<int:pk>/comments/', TrackCommentsView.as_view(), name='track-comments'),
    path('tracks/<int:pk>/comments/<int:comment_id>/like/', ToggleTrackCommentLikeView.as_view(), name='track-comment-like'),
    path('tracks/<int:pk>/comments/<int:comment_id>/', TrackCommentDeleteView.as_view(), name='track-comment-delete'),

    # DAW projects
    path('projects/', ProjectListCreateView.as_view(), name='project-list-create'),
    path('projects/<int:pk>/', ProjectDetailView.as_view(), name='project-detail'),

    # Publications (user's own)
    path('publications/', PublicationListCreateView.as_view(), name='publication-list-create'),
    path('publications/<int:pk>/', PublicationUpdateDeleteView.as_view(), name='publication-delete'),
    path('publications/<int:pk>/play/', PublicationPlayView.as_view(), name='publication-play'),
    path('publications/<int:pk>/like/', ToggleLikeView.as_view(), name='publication-like'),
    path('publications/<int:pk>/comments/', PublicationCommentsView.as_view(), name='publication-comments'),
    path('publications/<int:pk>/comments/<int:comment_id>/like/', TogglePublicationCommentLikeView.as_view(), name='publication-comment-like'),
    path('publications/<int:pk>/comments/<int:comment_id>/', PublicationCommentDeleteView.as_view(), name='publication-comment-delete'),

    # Library (user's liked songs)
    path('library/', LibraryView.as_view(), name='library'),

    # Public endpoints (no auth required)
    path('explore/', PublicTracksView.as_view(), name='public-tracks'),
    path('tracks/<int:pk>/detail/', TrackDetailView.as_view(), name='public-track-detail'),
    path('feed/', PublicFeedView.as_view(), name='public-feed'),
    path('publications/<int:pk>/detail/', PublicationDetailView.as_view(), name='public-publication-detail'),
    path('users/<str:username>/reposts/', UserRepostsView.as_view(), name='user-reposts'),
    path('users/<str:username>/', PublicUserProfileView.as_view(), name='public-user-profile'),
    path('users/<str:username>/follow/', ToggleFollowView.as_view(), name='toggle-follow'),
    path('users/<str:username>/followers/', FollowersListView.as_view(), name='followers-list'),
    path('users/<str:username>/following/', FollowingListView.as_view(), name='following-list'),
    path('users/<str:username>/publications/', UserPublicationsView.as_view(), name='user-publications'),
    path('search/', SearchView.as_view(), name='search'),
    path('trending/', TrendingTracksView.as_view(), name='trending'),
    path('new-releases/', NewReleasesView.as_view(), name='new-releases'),

    # Notifications
    path('notifications/', NotificationListView.as_view(), name='notification-list'),
    path('notifications/unread-count/', NotificationUnreadCountView.as_view(), name='notification-unread-count'),
    path('notifications/<int:pk>/read/', NotificationMarkReadView.as_view(), name='notification-mark-read'),
    path('notifications/mark-all-read/', NotificationMarkAllReadView.as_view(), name='notification-mark-all-read'),
]