from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from .config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=True)
async_session_local = async_sessionmaker(bind=engine, expire_on_commit=False)

async def get_db():
    async with async_session_local() as session:
        yield session