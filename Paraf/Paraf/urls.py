from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from utilisateur.views import CustomTokenObtainPairView, LogoutView, UserViewSet
from rest_framework_simplejwt.views import TokenRefreshView
from documents.views import (
    DocumentViewSet, PublicationViewSet, PermissionViewSet,
    AuditLogViewSet, CategoryViewSet, MemberListView,
    serve_protected_media,
)

router = DefaultRouter()
router.register(r'documents',    DocumentViewSet,    basename='document')
router.register(r'publications', PublicationViewSet, basename='publication')
router.register(r'permissions',  PermissionViewSet,  basename='permission')
router.register(r'audit',        AuditLogViewSet,    basename='audit')
router.register(r'categories',   CategoryViewSet,    basename='category')
router.register(r'members',      MemberListView,     basename='member')
router.register(r'users',        UserViewSet,        basename='user')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/',   CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(),          name='token_refresh'),
    # LogoutView personnalisée — ne requiert pas d'access token valide
    path('api/auth/logout/',  LogoutView.as_view(),                name='token_blacklist'),
    path('api/',              include(router.urls)),
    path('media/secure_media/<path:file_path>', serve_protected_media, name='protected_media'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
