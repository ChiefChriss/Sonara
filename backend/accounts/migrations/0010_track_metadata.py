from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0009_like'),
    ]

    operations = [
        migrations.AddField(
            model_name='track',
            name='play_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='track',
            name='like_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.CreateModel(
            name='TrackLike',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('track', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='track_likes', to='accounts.track')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='track_likes', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
                'unique_together': {('user', 'track')},
            },
        ),
    ]
