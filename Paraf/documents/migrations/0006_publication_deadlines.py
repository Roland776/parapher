# Migration générée manuellement
# Ajoute download_deadline et signature_deadline sur Publication

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        # Remplacer '0001_initial' par le nom réel de votre dernière migration
        # Vérifier avec : python manage.py showmigrations documents
        ('documents', '0005_alter_signature_document'),
    ]

    operations = [
        migrations.AddField(
            model_name='publication',
            name='download_deadline',
            field=models.DateField(
                blank=True,
                null=True,
                verbose_name='Date limite de téléchargement',
                help_text='Laisser vide pour aucune limite.',
            ),
        ),
        migrations.AddField(
            model_name='publication',
            name='signature_deadline',
            field=models.DateField(
                blank=True,
                null=True,
                verbose_name='Date limite de paraphe',
                help_text='Laisser vide pour aucune limite.',
            ),
        ),
    ]
