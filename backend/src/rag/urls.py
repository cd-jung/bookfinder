from django.urls import path

from rag import views

urlpatterns = [path("answers", views.answers), path("feedback", views.feedback)]
