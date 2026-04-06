from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth import get_user_model
from .models import Project, Publication, ContentComment, ContentCommentLike, TrackRepost

User = get_user_model()


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "email", "is_listener", "is_creator", "role", "is_staff")
    list_filter = ("is_listener", "is_creator", "is_staff", "is_active")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Roles", {"fields": ("is_listener", "is_creator")}),
        ("Profile", {"fields": ("bio", "header_image", "profile_picture")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("Roles", {"fields": ("is_listener", "is_creator")}),
    )


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "created_at", "updated_at")
    list_filter = ("user",)
    search_fields = ("name", "user__username")


@admin.register(Publication)
class PublicationAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "is_public", "play_count", "published_at")
    list_filter = ("is_public", "user")
    search_fields = ("title", "user__username")


@admin.register(ContentComment)
class ContentCommentAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "track", "publication", "parent", "created_at")
    list_filter = ("created_at",)
    search_fields = ("body", "user__username")
    raw_id_fields = ("user", "track", "publication", "parent")


@admin.register(ContentCommentLike)
class ContentCommentLikeAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "comment", "created_at")
    list_filter = ("created_at",)
    raw_id_fields = ("user", "comment")


@admin.register(TrackRepost)
class TrackRepostAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "track", "created_at")
    list_filter = ("created_at",)
    raw_id_fields = ("user", "track")