import datetime
import uuid
from django.db import models
from django.conf import settings

class Category(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')

    class Meta:
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name


class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='documents')
    version = models.IntegerField(default=1)
    storage_path = models.FileField(upload_to="secure_media/%Y/%m/%d/")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='uploaded_documents')

    def __str__(self):
        return f"{self.title} (v{self.version})"


class Permission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='document_permissions')
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='user_permissions')
    can_view = models.BooleanField(default=False)
    can_download = models.BooleanField(default=False)

    class Meta:
        unique_together = ('user', 'document')


class Publication(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='publications')
    publish_date = models.DateField()
    download_allowed = models.BooleanField(default=False)
    print_allowed = models.BooleanField(default=False)
    signature_required = models.BooleanField(default=False)
    # ── Remarque/commentaire de l'admin à l'attention des membres ────────────
    admin_note = models.TextField(blank=True, default='', verbose_name='Remarque / commentaire admin')
    # ── Deadline de téléchargement et de signature ───────────────────────────
    # None = pas de limite de temps (accessible indéfiniment)
    # Une date = bloqué après cette date
    download_deadline = models.DateField(
        null=True, blank=True,
        verbose_name='Date limite de téléchargement',
        help_text='Laisser vide pour aucune limite. Après cette date, le téléchargement sera bloqué.',
    )
    signature_deadline = models.DateField(
        null=True, blank=True,
        verbose_name='Date limite de paraphe',
        help_text='Laisser vide pour aucune limite. Après cette date, le paraphe sera bloqué.',
    )
    # ── Expiration de la publication ─────────────────────────────────────────
    # None = visible indéfiniment
    # Une date = la publication disparaît de la liste des membres après cette date
    # L'admin peut toujours la voir (archived=True) pour l'historique
    expires_at = models.DateField(
        null=True, blank=True,
        verbose_name="Date d'expiration",
        help_text='Laisser vide pour visible indéfiniment. Après cette date, la publication est archivée.',
    )
    archived = models.BooleanField(
        default=False,
        verbose_name='Archivée',
        help_text="Si coché, la publication est masquée pour les membres mais reste dans l'historique admin.",
    )

    class Meta:
        ordering = ['-publish_date']

    def __str__(self):
        return f"Publication de {self.document.title} le {self.publish_date}"

    def is_visible(self):
        """Retourne True si la publication est visible pour les membres aujourd'hui."""
        if self.archived:
            return False
        if self.expires_at is None:
            return True
        return datetime.date.today() <= self.expires_at

    def is_download_open(self):
        """Retourne True si le téléchargement est encore autorisé aujourd'hui."""
        if not self.download_allowed:
            return False
        if self.download_deadline is None:
            return True  # pas de limite
        return datetime.date.today() <= self.download_deadline

    def is_signature_open(self):
        """Retourne True si le paraphe est encore autorisé aujourd'hui."""
        if not self.signature_required:
            return False
        if self.signature_deadline is None:
            return True  # pas de limite
        return datetime.date.today() <= self.signature_deadline


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    action = models.CharField(max_length=50)
    target_id = models.UUIDField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']


class Signature(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='signatures')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='signatures_apposees')
    signature_data = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Paraphe de {self.user.username} sur {self.document.title}"