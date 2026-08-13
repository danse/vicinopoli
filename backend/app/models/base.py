"""SQLAlchemy declarative base for all vicinopoli models."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared base for the application's ORM models."""
