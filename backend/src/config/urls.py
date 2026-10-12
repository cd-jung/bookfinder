from django.urls import include, path

from core import views as core_views

urlpatterns = [
    path("api/health", core_views.health),
    path("api/logs/", include("logs.urls")),
    path("api/rag/", include("rag.urls")),
]
