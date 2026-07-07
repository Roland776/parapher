from django.db import models

# Create your models here.
import uuid
from django.contrib.auth.models import AbstractUser


class CustomUser(AbstractUser):
    ROLE_CHOICES = (
        ('ADMIN', 'Administrateur'),
        ('MEMBER', 'Membre'),
    )
    
    # Remplacement de l'ID classique par un UUID pour plus de sécurité
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='MEMBER')
    
    # Nous pourrons ajouter d'autres champs ici (ex: téléphone pour le MFA par SMS)

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"