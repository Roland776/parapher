from rest_framework import serializers
from .models import Document, Category, Permission, Publication, AuditLog, Signature


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'parent']


class DocumentSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.username', read_only=True)

    class Meta:
        model = Document
        fields = ['id', 'title', 'category', 'category_name', 'version',
                  'storage_path', 'uploaded_at', 'uploaded_by_name']
        read_only_fields = ['version', 'uploaded_by']


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'user', 'document', 'can_view', 'can_download']


class PublicationSerializer(serializers.ModelSerializer):
    document_title  = serializers.CharField(source='document.title', read_only=True)
    # Champs calculés — indiquent au frontend si l'action est encore ouverte aujourd'hui
    download_open   = serializers.SerializerMethodField()
    signature_open  = serializers.SerializerMethodField()
    is_visible      = serializers.SerializerMethodField()

    class Meta:
        model = Publication
        fields = [
            'id', 'document', 'document_title', 'publish_date',
            'download_allowed', 'print_allowed', 'signature_required',
            'admin_note',
            'download_deadline',   # date limite ou null
            'signature_deadline',  # date limite ou null
            'expires_at',          # expiration de la publication ou null
            'archived',            # archivée manuellement par l'admin
            'download_open',       # bool calculé : encore accessible aujourd'hui ?
            'signature_open',      # bool calculé : encore accessible aujourd'hui ?
            'is_visible',          # bool calculé : visible pour les membres aujourd'hui ?
        ]
        read_only_fields = ['publish_date']

    def get_download_open(self, obj):
        return obj.is_download_open()

    def get_signature_open(self, obj):
        return obj.is_signature_open()

    def get_is_visible(self, obj):
        return obj.is_visible()


class AuditLogSerializer(serializers.ModelSerializer):
    user_email    = serializers.CharField(source='user.email',    read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = AuditLog
        fields = ['id', 'user', 'user_email', 'user_username', 'action', 'target_id', 'timestamp']


class SignatureSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Signature
        fields = ['id', 'document', 'user', 'user_name', 'signature_data', 'timestamp']