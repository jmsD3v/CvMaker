from fastapi import HTTPException

# Extensión que llega del cliente -> sufijo fijo para el archivo temporal.
# El sufijo sale siempre de esta tabla, nunca del texto recibido.
_SUFFIX_BY_TYPE = {
    "pdf": ".pdf",
    "png": ".png",
    "jpg": ".jpg",
    "jpeg": ".jpg",
}


def validate_cert_request(user_id: str, file_url: str, file_type: str) -> str:
    """Valida el pedido de extracción y devuelve el sufijo seguro del temporal.

    - file_type tiene que estar en la lista permitida (400 si no).
    - file_url tiene que ser un archivo dentro de la carpeta del propio usuario
      en el bucket ("<user_id>/<archivo>"), sin saltos de carpeta (403 si no).
      El backend usa la service_role key, que no pasa por RLS, así que este
      chequeo es lo único que impide leer archivos de otro usuario.
    """
    suffix = _SUFFIX_BY_TYPE.get(file_type.lower())
    if suffix is None:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido")

    prefix = f"{user_id}/"
    name = file_url[len(prefix):] if file_url.startswith(prefix) else ""
    if not name or ".." in file_url or "\\" in file_url or "/" in name:
        raise HTTPException(status_code=403, detail="Forbidden")

    return suffix
