from django.contrib import admin
from .models import Document, DocumentChunk


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "file_type", "status", "chunk_count", "created_at")
    list_filter = ("status", "file_type")
    search_fields = ("title", "user__email")
    readonly_fields = ("chunk_count", "created_at", "updated_at")


@admin.register(DocumentChunk)
class DocumentChunkAdmin(admin.ModelAdmin):
    list_display = ("document", "chunk_index", "faiss_vector_id")
    search_fields = ("document__title", "content")
