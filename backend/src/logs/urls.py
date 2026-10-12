from django.urls import path

from logs import views

urlpatterns = [
    path("", views.log_list),
    path("stats", views.stats),
    path("nl-search/translate", views.nl_translate),
    path("nl-search/examples", views.nl_examples),
]
