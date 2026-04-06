from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
from cloudinary_storage.storage import RawMediaCloudinaryStorage


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_track'),
    ]

    operations = [
        migrations.CreateModel(
            name='Project',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(default='Untitled Project', max_length=255)),
                ('data', models.JSONField(default=dict, help_text='Full DAW state: tracks, clips, notes, effects, bpm, etc.')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='projects', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-updated_at'],
            },
        ),
        migrations.CreateModel(
            name='Publication',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True, default='')),
                ('audio_file', models.FileField(storage=RawMediaCloudinaryStorage(), upload_to='publications/', validators=[])),
                ('cover_image', models.ImageField(blank=True, null=True, upload_to='publications/covers/', validators=[])),
                ('is_public', models.BooleanField(default=True)),
                ('play_count', models.PositiveIntegerField(default=0)),
                ('published_at', models.DateTimeField(auto_now_add=True)),
                ('project', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='publications', to='accounts.project')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='publications', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-published_at'],
            },
        ),
    ]
