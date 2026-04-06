from django.db import migrations, models
import django.db.models.deletion


def truncate_long_comment_bodies(apps, schema_editor):
    ContentComment = apps.get_model('accounts', 'ContentComment')
    for row in ContentComment.objects.all().only('id', 'body'):
        if len(row.body) > 500:
            row.body = row.body[:500]
            row.save(update_fields=['body'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0014_contentcomment'),
    ]

    operations = [
        migrations.RunPython(truncate_long_comment_bodies, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='contentcomment',
            name='body',
            field=models.CharField(max_length=500),
        ),
        migrations.AddField(
            model_name='contentcomment',
            name='parent',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='replies',
                to='accounts.contentcomment',
            ),
        ),
    ]
