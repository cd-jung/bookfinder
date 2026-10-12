from django.urls import path

from books import views

urlpatterns = [
    path("books", views.book_list),
    path("books/facets", views.facets),
    path("books/<int:book_id>", views.book_detail),
    path("authors", views.authors),
    path("nl-search/translate", views.nl_translate),
]
