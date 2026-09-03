from typing import Annotated

from bson import ObjectId
from pydantic import BeforeValidator


def validate_object_id(value: object) -> str:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, str) and ObjectId.is_valid(value):
        return value
    raise ValueError("Invalid ObjectId")


# A Mongo ObjectId represented as a plain string everywhere outside the repository layer.
PyObjectId = Annotated[str, BeforeValidator(validate_object_id)]
