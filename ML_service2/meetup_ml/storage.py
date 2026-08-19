import json
from pathlib import Path

from .schemas import Movie


class JsonStore:
    def __init__(self, root: Path):
        self.root = root
        self.raw = root / "raw"
        self.normalized = root / "normalized"
        self.state = root / "state"

        for path in (
            self.raw,
            self.normalized,
            self.state,
        ):
            path.mkdir(
                parents=True,
                exist_ok=True,
            )

    def append_jsonl(
        self,
        path: Path,
        row: dict,
    ) -> None:
        path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        with path.open(
            "a",
            encoding="utf-8",
        ) as stream:
            stream.write(
                json.dumps(
                    row,
                    ensure_ascii=False,
                )
                + "\n"
            )

    def save_movies(
        self,
        movies: list[Movie],
    ) -> Path:
        target = (
            self.normalized
            / "movies.json"
        )

        target.write_text(
            json.dumps(
                [
                    movie.model_dump()
                    for movie in movies
                ],
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        return target

    def load_movies(
        self,
        use_fixture: bool = True,
    ) -> list[Movie]:
        default_target = (
            self.normalized
            / "movies.json"
        )

        target = default_target

        if not target.exists():
            if not use_fixture:
                return []

            target = (
                Path(__file__).parents[1]
                / "fixtures"
                / "movies.json"
            )

        rows = json.loads(
            target.read_text(
                encoding="utf-8",
            )
        )

        return [
            Movie.model_validate(row)
            for row in rows
        ]
