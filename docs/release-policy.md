# Release-Richtlinie (Tester-Phase)

- **GitHub:** Commits und Tags auf `main` – Tester installieren vom Repo (GitHub / npm `github:`).
- **npm:** Nur wenn ein Zwischenstand **stabil** getestet ist – dann gezielt eine Version nach npm publishen.
- Kein automatisches npm-Deploy bei jedem Tag, solange diese Phase gilt (siehe CI-Konfiguration / manuelles Release).
