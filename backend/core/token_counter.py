class TokenCounter:
    def __init__(self):
        self.ingestion_total = 0
        self.query_total     = 0

    def add(self, usage, phase: str = "query"):
        tokens = usage.prompt_tokens + usage.completion_tokens
        if phase == "ingestion":
            self.ingestion_total += tokens
        else:
            self.query_total += tokens

    def summary(self) -> dict:
        return {
            "ingestion_tokens": self.ingestion_total,
            "query_tokens":     self.query_total,
            "grand_total":      self.ingestion_total + self.query_total,
        }
