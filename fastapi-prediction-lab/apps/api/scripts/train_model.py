"""Huấn luyện lại model (tuỳ chọn). Cần mạng để tải dataset 20 Newsgroups lần đầu.

    python apps/api/scripts/train_model.py
"""

import datetime
from pathlib import Path

import joblib
import sklearn
from sklearn.datasets import fetch_20newsgroups
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline

CATEGORIES = [
    "soc.religion.christian",
    "talk.religion.misc",
    "comp.sys.mac.hardware",
    "sci.crypt",
]
OUTPUT = Path(__file__).resolve().parent.parent / "models" / "newsgroups_model.joblib"


def main() -> None:
    train = fetch_20newsgroups(subset="train", categories=CATEGORIES, random_state=0)
    test = fetch_20newsgroups(subset="test", categories=CATEGORIES, random_state=0)

    model = make_pipeline(TfidfVectorizer(), MultinomialNB())
    model.fit(train.data, train.target)

    accuracy = model.score(test.data, test.target)
    print(f"Độ chính xác trên tập test: {accuracy:.4f}")

    metadata = {
        "sklearn_version": sklearn.__version__,
        "trained_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "accuracy_test": round(float(accuracy), 4),
        "categories": list(train.target_names),
    }
    print(f"Metadata: {metadata}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump((model, train.target_names, metadata), OUTPUT)
    print(f"Đã lưu model: {OUTPUT}")


if __name__ == "__main__":
    main()
