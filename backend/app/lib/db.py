# backend/app/lib/db.py
"""
Database connection management for LEXMETRA.
Handles connection pooling, session management, and migrations.
"""
import os
from typing import Generator, Optional
from contextlib import contextmanager
from functools import lru_cache

from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, scoped_session
from sqlalchemy.pool import QueuePool
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.engine import Engine

# Import settings - adjust based on your config structure
try:
    from app.config import settings
except ImportError:
    # Fallback settings if config doesn't exist yet
    class Settings:
        DATABASE_URL: str = os.getenv(
            "DATABASE_URL",
            "postgresql://lexmetra:lexmetra@localhost:5433/lexmetra"
        )
        DB_ECHO: bool = os.getenv("DB_ECHO", "False").lower() == "true"
        DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "5"))
        DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "10"))
        DB_POOL_RECYCLE: int = int(os.getenv("DB_POOL_RECYCLE", "3600"))
        DB_POOL_TIMEOUT: int = int(os.getenv("DB_POOL_TIMEOUT", "30"))
    settings = Settings()

# Create declarative base for models
Base = declarative_base()

# Database engine instance
_engine = None
_SessionLocal = None
_scoped_session = None


def get_engine() -> Engine:
    """Get or create database engine with connection pooling."""
    global _engine
    
    if _engine is None:
        # SQLite-specific configuration
        if settings.DATABASE_URL.startswith("sqlite"):
            # SQLite doesn't support connection pooling in the same way
            _engine = create_engine(
                settings.DATABASE_URL,
                echo=settings.DB_ECHO,
                connect_args={"check_same_thread": False},
                poolclass=QueuePool,
                pool_size=1,  # SQLite works better with single connection
                max_overflow=0,
                pool_pre_ping=True,
            )
        else:
            # PostgreSQL/MySQL configuration
            _engine = create_engine(
                settings.DATABASE_URL,
                echo=settings.DB_ECHO,
                poolclass=QueuePool,
                pool_size=settings.DB_POOL_SIZE,
                max_overflow=settings.DB_MAX_OVERFLOW,
                pool_recycle=settings.DB_POOL_RECYCLE,
                pool_timeout=settings.DB_POOL_TIMEOUT,
                pool_pre_ping=True,
            )
        
        # Event listener for connection errors
        @event.listens_for(_engine, "connect")
        def receive_connect(dbapi_connection, connection_record):
            """Handle connection events."""
            pass  # Add custom connection logic here if needed
    
    return _engine


def get_session_factory() -> sessionmaker:
    """Get or create session factory."""
    global _SessionLocal
    
    if _SessionLocal is None:
        engine = get_engine()
        _SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=engine,
        )
    
    return _SessionLocal


def get_scoped_session() -> scoped_session:
    """Get or create scoped session for thread-safe operations."""
    global _scoped_session
    
    if _scoped_session is None:
        session_factory = get_session_factory()
        _scoped_session = scoped_session(session_factory)
    
    return _scoped_session


def get_db() -> Generator[Session, None, None]:
    """
    Dependency for FastAPI routes.
    Yields a database session and ensures it's closed after use.
    
    Usage:
        @app.get("/items")
        def get_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    session_factory = get_session_factory()
    db = session_factory()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    """
    Context manager for database sessions.
    Useful for non-FastAPI contexts like background tasks, scripts.
    
    Usage:
        with get_db_context() as db:
            db.add(item)
            db.commit()
    """
    session_factory = get_session_factory()
    db = session_factory()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


class DatabaseManager:
    """
    Singleton database manager for advanced operations.
    Provides methods for connection management, migrations, and utilities.
    """
    _instance = None
    _engine = None
    _session_factory = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        self._initialized = False
    
    def initialize(self, database_url: Optional[str] = None):
        """Initialize database with optional custom URL."""
        if self._initialized:
            return
        
        if database_url:
            # Override settings if custom URL provided
            os.environ["DATABASE_URL"] = database_url
        
        self._engine = get_engine()
        self._session_factory = get_session_factory()
        self._initialized = True
    
    @property
    def engine(self) -> Engine:
        """Get database engine."""
        if self._engine is None:
            self._engine = get_engine()
        return self._engine
    
    @property
    def session_factory(self) -> sessionmaker:
        """Get session factory."""
        if self._session_factory is None:
            self._session_factory = get_session_factory()
        return self._session_factory
    
    def create_tables(self, drop_first: bool = False):
        """
        Create all tables defined in Base.
        
        Args:
            drop_first: Drop existing tables before creating
        """
        if drop_first:
            Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
    
    def get_session(self) -> Session:
        """Get a new session."""
        return self.session_factory()
    
    @contextmanager
    def session_scope(self) -> Generator[Session, None, None]:
        """
        Context manager for session with automatic commit/rollback.
        
        Usage:
            with db_manager.session_scope() as session:
                session.add(item)
                # Auto-commits on success, rollbacks on error
        """
        session = self.get_session()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
    
    def execute_raw_sql(self, sql: str, params: Optional[dict] = None):
        """Execute raw SQL (for migrations or complex queries)."""
        with self.session_scope() as session:
            result = session.execute(sql, params or {})
            return result
    
    def check_connection(self) -> bool:
        """Check if database connection is healthy."""
        try:
            with self.session_scope() as session:
                session.execute("SELECT 1")
            return True
        except SQLAlchemyError as e:
            print(f"Connection check failed: {e}")
            return False
    
    def get_table_names(self) -> list:
        """Get list of all table names."""
        import sqlalchemy
        inspector = sqlalchemy.inspect(self.engine)
        return inspector.get_table_names()
    
    def vacuum(self):
        """Vacuum/optimize database (SQLite only)."""
        if self.engine.dialect.name == "sqlite":
            with self.engine.connect() as conn:
                conn.execute("VACUUM")


# Global instance for easy access
db_manager = DatabaseManager()


# Convenience functions
def init_db(database_url: Optional[str] = None):
    """Initialize database with optional custom URL."""
    db_manager.initialize(database_url)


def create_tables(drop_first: bool = False):
    """Create all database tables."""
    db_manager.create_tables(drop_first=drop_first)


def get_session() -> Session:
    """Get a new database session."""
    return db_manager.get_session()


def check_db_health() -> bool:
    """Check database connection health."""
    return db_manager.check_connection()


# Import sqlalchemy inspector here to avoid circular imports
import sqlalchemy


# For Alembic migrations support
def get_alembic_config():
    """Get Alembic configuration for migrations."""
    from alembic.config import Config
    from alembic import command
    
    alembic_cfg = Config("alembic.ini")
    return alembic_cfg


def run_migrations():
    """Run database migrations using Alembic."""
    alembic_cfg = get_alembic_config()
    command.upgrade(alembic_cfg, "head")


# Example config file if you want to separate settings
class DatabaseConfig:
    """Database configuration class."""
    
    @staticmethod
    def get_url() -> str:
        """Get database URL from environment or default."""
        return os.getenv(
            "DATABASE_URL",
            "postgresql://lexmetra:lexmetra@localhost:5433/lexmetra"
        )
    
    @staticmethod
    def get_async_url() -> str:
        """Get async database URL (for async SQLAlchemy)."""
        url = DatabaseConfig.get_url()
        # Convert sync URL to async
        if url.startswith("sqlite"):
            return url.replace("sqlite:///", "sqlite+aiosqlite:///")
        if url.startswith("postgresql"):
            return url.replace("postgresql://", "postgresql+asyncpg://")
        if url.startswith("mysql"):
            return url.replace("mysql://", "mysql+aiomysql://")
        return url


def generate_uuid():
    """Generate a UUID string for models."""
    import uuid
    return str(uuid.uuid4())


# Update settings with async support if needed
if not hasattr(settings, "ASYNC_DATABASE_URL"):
    settings.ASYNC_DATABASE_URL = DatabaseConfig.get_async_url()