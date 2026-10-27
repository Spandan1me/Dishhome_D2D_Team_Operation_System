from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('imports', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='customerbatchrecord',
            name='created_from_batch',
            field=models.BooleanField(default=False),
        ),
    ]
