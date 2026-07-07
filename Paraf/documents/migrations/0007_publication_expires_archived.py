from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        # Dépend de la migration précédente (deadlines)
        ('documents', '0006_publication_deadlines'),
    ]

    operations = [
        migrations.AddField(
            model_name='publication',
            name='expires_at',
            field=models.DateField(
                blank=True,
                null=True,
                verbose_name="Date d'expiration",
                help_text='Laisser vide pour visible indéfiniment.',
            ),
        ),
        migrations.AddField(
            model_name='publication',
            name='archived',
            field=models.BooleanField(
                default=False,
                verbose_name='Archivée',
                help_text="Si coché, masquée pour les membres mais visible dans l'historique admin.",
            ),
        ),
        migrations.AlterModelOptions(
            name='publication',
            options={'ordering': ['-publish_date']},
        ),
    ]
