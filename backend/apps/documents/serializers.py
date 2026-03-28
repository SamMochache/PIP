from rest_framework import serializers
from .models import Document, DocumentChunk


class DocumentChunkSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentChunk
        fields = ("id", "chunk_index", "content")


class DocumentSerializer(serializers.ModelSerializer):
    """Used when listing documents — shows metadata but not chunks."""

    class Meta:
        model = Document
        fields = (
            "id",
            "title",
            "file_type",
            "file_size",
            "status",
            "chunk_count",
            "error_message",
            "created_at",
        )
        read_only_fields = fields


class DocumentUploadSerializer(serializers.Serializer):
    """
    Validates an upload request.
    'file' is the raw uploaded file object from the request.
    """

    file = serializers.FileField()

    def validate_file(self, value):
        """Check file type and size."""
        allowed_types = ["application/pdf", "text/plain",
                         "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
        max_size = 50 * 1024 * 1024  # 50 MB

        if value.content_type not in allowed_types:
            raise serializers.ValidationError(
                "Only PDF, DOCX, and TXT files are supported."
            )

        if value.size > max_size:
            raise serializers.ValidationError("File too large. Max size is 50 MB.")

        return value
