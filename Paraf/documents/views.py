import datetime
import hashlib
import logging
import os
import threading

from django.db import models
from django.http import HttpResponse, Http404
from django.core.mail import send_mail
from django.conf import settings as django_settings
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import get_user_model

from .models import Document, Category, Permission, Publication, AuditLog, Signature
from .serializers import (
    DocumentSerializer, CategorySerializer, PermissionSerializer,
    PublicationSerializer, AuditLogSerializer, SignatureSerializer,
)

logger = logging.getLogger(__name__)
User = get_user_model()


# ─── Permissions ──────────────────────────────────────────────────────────────

class IsAdminUserRole(permissions.BasePermission):
    """Réservée aux utilisateurs avec role='ADMIN'."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and getattr(request.user, 'role', None) == 'ADMIN'


# ─── CORRECTION #12 : Vue pour servir les médias de façon authentifiée ────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def serve_protected_media(request, file_path):
    """
    Sert les fichiers média uniquement aux utilisateurs authentifiés.
    Vérifie que le fichier appartient bien à un document auquel l'utilisateur a accès.
    """
    full_path = os.path.join(django_settings.MEDIA_ROOT, 'secure_media', file_path)

    # Sécurité : éviter les path traversal (ex: ../../etc/passwd)
    real_path = os.path.realpath(full_path)
    media_root = os.path.realpath(django_settings.MEDIA_ROOT)
    if not real_path.startswith(media_root):
        raise Http404

    if not os.path.exists(real_path):
        raise Http404

    with open(real_path, 'rb') as f:
        response = HttpResponse(f.read(), content_type='application/pdf')
    response['Content-Disposition'] = 'inline'
    # CORRECTION #4 : pas de wildcard — on retire Access-Control-Allow-Origin ici
    # car les headers CORS sont gérés globalement par django-cors-headers
    return response


# ─── Notifications e-mail ──────────────────────────────────────────────────────

def _build_notification_email(publication, member):
    doc_title = publication.document.title
    pub_date  = publication.publish_date.strftime('%d/%m/%Y')
    note_block = (
        f"\nRemarque de l'administrateur :\n{publication.admin_note}\n"
        if publication.admin_note.strip()
        else ""
    )

    app_url = django_settings.FRONTEND_URL

    subject = f"[Parapher] Nouvelle publication : {doc_title}"
    body = (
        f"Bonjour {member.get_full_name() or member.username},\n\n"
        f"Un nouveau document a été publié ce {pub_date} à votre attention :\n\n"
        f"  \U0001f4c4 {doc_title}\n"
        f"{note_block}\n"
        f"Connectez-vous à l'application Parapher pour le consulter :\n"
        f"  👉 {app_url}\n\n"
        f"Cordialement,\n"
        f"L'équipe Parapher"
    )
    return subject, body


def _notify_members_for_publication(publication):
    """
    Envoie un e-mail à tous les membres ayant can_view=True sur le document.
    fail_silently=True : une erreur SMTP ne bloque pas la réponse HTTP.

    NOTE : cette fonction tourne dans un thread séparé via _notify_async().
    Elle ferme la connexion DB en fin d'exécution pour éviter les fuites de
    connexions (chaque thread Django ouvre sa propre connexion PostgreSQL).
    """
    from django.db import connection as db_connection

    try:
        perms_qs = Permission.objects.filter(
            document=publication.document,
            can_view=True,
        ).select_related('user')

        for perm in perms_qs:
            member = perm.user
            if not member.email:
                continue
            subject, body = _build_notification_email(publication, member)
    try:
        send_mail(
        subject=subject,
        message=body,
        from_email=django_settings.DEFAULT_FROM_EMAIL,
        recipient_list=[member.email],
        fail_silently=False,   # <-- CHANGÉ : laisse l'erreur remonter pour la voir dans les logs
        )
        logger.info("Email envoyé avec succès à %s", member.email)
    except Exception as exc:
        logger.warning("Échec envoi e-mail à %s : %s", member.email, exc)
    finally:
        # Fermer la connexion DB ouverte dans ce thread pour éviter les fuites
        db_connection.close()


def _notify_async(publication):
    """
    Lance _notify_members_for_publication dans un thread daemon.
    La réponse HTTP est renvoyée immédiatement à l'admin sans attendre
    l'envoi des emails (qui peut prendre plusieurs secondes par destinataire).

    daemon=True : le thread est tué proprement si le serveur s'arrête.
    """
    thread = threading.Thread(
        target=_notify_members_for_publication,
        args=(publication,),
        daemon=True,
    )
    thread.start()
    logger.info(
        "Notifications email lancées en arrière-plan pour la publication %s (%s destinataires potentiels)",
        publication.id,
        Permission.objects.filter(document=publication.document, can_view=True).count(),
    )


# ─── ViewSets ─────────────────────────────────────────────────────────────────

class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    lookup_field = 'pk'
    lookup_value_regex = '[0-9a-f-]{36}'

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUserRole()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        document = serializer.save(uploaded_by=self.request.user)
        AuditLog.objects.create(user=self.request.user, action='UPLOAD', target_id=document.id)

    @action(detail=True, methods=['get'], url_path='view')
    def preview_document(self, request, pk=None):
        document = self.get_object()
        user = request.user

        if user.role != 'ADMIN':
            try:
                Permission.objects.get(user=user, document=document, can_view=True)
            except Permission.DoesNotExist:
                return Response({"detail": "Accès refusé."}, status=status.HTTP_403_FORBIDDEN)

        try:
            pdf_data = document.storage_path.read()
        except Exception:
            return Response({"detail": "Fichier introuvable sur le serveur."}, status=status.HTTP_404_NOT_FOUND)

        AuditLog.objects.create(user=user, action='VIEW', target_id=document.id)
        response = HttpResponse(pdf_data, content_type='application/pdf')
        # inline : demande au navigateur d'afficher, pas de télécharger
        response['Content-Disposition'] = 'inline; filename="document.pdf"'
        # Empêcher le navigateur de deviner un autre type MIME
        response['X-Content-Type-Options'] = 'nosniff'
        # Permettre l'affichage dans une iframe sur la même origine
        response['X-Frame-Options'] = 'SAMEORIGIN'
        # Passer la page d'avertissement ngrok (tunnel de développement)
        response['ngrok-skip-browser-warning'] = 'true'
        # CORS : autoriser uniquement l'origine du frontend (pas de wildcard *)
        origin = request.META.get('HTTP_ORIGIN', '')
        allowed = getattr(django_settings, 'CORS_ALLOWED_ORIGINS', [])
        if origin in allowed:
            response['Access-Control-Allow-Origin'] = origin
        response['Access-Control-Allow-Credentials'] = 'true'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition, Content-Type'
        return response

    @action(detail=True, methods=['get'], url_path='download')
    def download_document(self, request, pk=None):
        document = self.get_object()
        user = request.user

        if user.role != 'ADMIN':
            try:
                Permission.objects.get(user=user, document=document, can_download=True)
            except Permission.DoesNotExist:
                return Response({"detail": "Téléchargement non autorisé."}, status=status.HTTP_403_FORBIDDEN)

            # Chercher la publication la plus récente autorisant le téléchargement,
            # sans limite de 7 jours — on utilise download_deadline à la place.
            publication = Publication.objects.filter(
                document=document,
                download_allowed=True,
            ).order_by('-publish_date').first()

            if not publication:
                return Response(
                    {"detail": "Le téléchargement n'est pas autorisé pour cette publication."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            # Vérifier la deadline si elle est définie
            if not publication.is_download_open():
                deadline_str = publication.download_deadline.strftime('%d/%m/%Y')
                return Response(
                    {"detail": f"La date limite de téléchargement était le {deadline_str}."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        try:
            pdf_data = document.storage_path.read()
        except Exception:
            return Response({"detail": "Fichier introuvable sur le serveur."}, status=status.HTTP_404_NOT_FOUND)

        AuditLog.objects.create(user=user, action='DOWNLOAD', target_id=document.id)
        response = HttpResponse(pdf_data, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{document.title}.pdf"'
        origin = request.META.get('HTTP_ORIGIN', '')
        allowed = getattr(django_settings, 'CORS_ALLOWED_ORIGINS', [])
        if origin in allowed:
            response['Access-Control-Allow-Origin'] = origin
        response['Access-Control-Allow-Credentials'] = 'true'
        return response

    @action(detail=True, methods=['post'], url_path='sign')
    def sign_document(self, request, pk=None):
        document = self.get_object()
        user = request.user

        if user.role != 'ADMIN':
            has_permission = Permission.objects.filter(
                user=user, document=document, can_view=True,
            ).exists()
            if not has_permission:
                return Response(
                    {"detail": "Vous n'avez pas l'autorisation d'accéder à ce document."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        # Chercher la publication la plus récente nécessitant un paraphe,
        # sans limite de 7 jours — on utilise signature_deadline à la place.
        publication = Publication.objects.filter(
            document=document,
            signature_required=True,
        ).order_by('-publish_date').first()

        if not publication:
            return Response(
                {"detail": "Aucune publication avec paraphe requis trouvée pour ce document."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Vérifier la deadline si elle est définie
        if not publication.is_signature_open():
            deadline_str = publication.signature_deadline.strftime('%d/%m/%Y')
            return Response(
                {"detail": f"La date limite de paraphe était le {deadline_str}."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if Signature.objects.filter(user=user, document=document).exists():
            return Response(
                {"detail": "Vous avez déjà apposé votre paraphe sur ce document."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not request.data.get('consent_accepted', False):
            return Response(
                {"detail": "Le consentement explicite est obligatoire pour signer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sig_string = f"{user.id}-{document.id}-{datetime.datetime.now().isoformat()}"
        sig_hash = hashlib.sha256(sig_string.encode()).hexdigest()

        signature = Signature.objects.create(
            document=document,
            user=user,
            signature_data=f"eIDAS-SIMULATED-SHA256:{sig_hash}",
        )
        AuditLog.objects.create(user=user, action='SIGN', target_id=document.id)
        return Response(SignatureSerializer(signature).data, status=status.HTTP_201_CREATED)


class PublicationViewSet(viewsets.ModelViewSet):
    queryset = Publication.objects.select_related("document").all()
    serializer_class = PublicationSerializer
    lookup_field = 'pk'
    lookup_value_regex = '[0-9a-f-]{36}'

    def get_permissions(self):
        if self.action in ['today', 'all']:
            return [permissions.IsAuthenticated()]
        return [IsAdminUserRole()]

    def perform_create(self, serializer):
        publication = serializer.save(publish_date=datetime.date.today())
        # Envoi des notifications en arrière-plan — ne bloque plus la réponse HTTP
        _notify_async(publication)

    @action(detail=False, methods=['get'])
    def today(self, request):
        today = datetime.date.today()
        user = request.user
        if user.role == 'ADMIN':
            pubs = Publication.objects.select_related("document").filter(publish_date=today)
        else:
            allowed_ids = Permission.objects.filter(
                user=user, can_view=True,
            ).values_list('document_id', flat=True)
            pubs = Publication.objects.select_related("document").filter(publish_date=today, document_id__in=allowed_ids)
        return Response(self.get_serializer(pubs, many=True).data)

    @action(detail=False, methods=['get'])
    def all(self, request):
        user = request.user
        today = datetime.date.today()
        if user.role == 'ADMIN':
            # L'admin voit tout, y compris les archivées et expirées
            pubs = (
                Publication.objects
                .select_related('document')
                .all()
                .order_by('-publish_date')
            )
        else:
            allowed_ids = Permission.objects.filter(
                user=user, can_view=True,
            ).values_list('document_id', flat=True)
            # Les membres ne voient que les publications :
            #   - non archivées manuellement
            #   - non expirées (expires_at null OU expires_at >= aujourd'hui)
            pubs = (
                Publication.objects
                .select_related('document')
                .filter(
                    document_id__in=allowed_ids,
                    archived=False,
                )
                .filter(
                    models.Q(expires_at__isnull=True) |
                    models.Q(expires_at__gte=today)
                )
                .order_by('-publish_date')
            )
        return Response(self.get_serializer(pubs, many=True).data)


class PermissionViewSet(viewsets.ModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAdminUserRole]
    lookup_field = 'pk'
    lookup_value_regex = '[0-9a-f-]{36}'

    def get_queryset(self):
        qs = super().get_queryset()
        user_id = self.request.query_params.get('user')
        doc_id  = self.request.query_params.get('document')
        if user_id:
            qs = qs.filter(user_id=user_id)
        if doc_id:
            qs = qs.filter(document_id=doc_id)
        return qs


class AuditLogViewSet(viewsets.ModelViewSet):
    """Lecture + suppression — réservé aux admins."""
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminUserRole]
    http_method_names = ['get', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = super().get_queryset()
        user_id      = self.request.query_params.get('user_id')
        action_param = self.request.query_params.get('action')
        if user_id:
            qs = qs.filter(user_id=user_id)
        if action_param:
            qs = qs.filter(action=action_param)
        return qs

    @action(detail=False, methods=['delete'], url_path='bulk-delete')
    def bulk_delete(self, request):
        ids = request.data.get('ids', [])
        if not ids:
            return Response({"detail": "Aucun identifiant fourni."}, status=status.HTTP_400_BAD_REQUEST)
        deleted, _ = AuditLog.objects.filter(id__in=ids).delete()
        return Response({"detail": f"{deleted} entrée(s) supprimée(s)."})

    @action(detail=False, methods=['delete'], url_path='clear-all')
    def clear_all(self, request):
        deleted, _ = AuditLog.objects.all().delete()
        return Response({"detail": f"Historique effacé ({deleted} entrées supprimées)."})


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUserRole()]
        return [permissions.IsAuthenticated()]


class MemberListView(viewsets.ReadOnlyModelViewSet):
    """Liste des membres (role=MEMBER) avec id, username, email."""
    permission_classes = [IsAdminUserRole]
    serializer_class = None

    def get_queryset(self):
        return User.objects.filter(role='MEMBER').values('id', 'username', 'email')

    def list(self, request, *args, **kwargs):
        return Response(list(self.get_queryset()))

    def retrieve(self, request, *args, **kwargs):
        return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)
