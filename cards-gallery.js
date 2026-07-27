(function () {
    "use strict";

    const statusEl = document.getElementById("status");
    const galleryEl = document.getElementById("gallery");
    const reloadBtn = document.getElementById("reload-btn");

    const config = getConfig();

    function getConfig() {
        const defaults = {
            owner: "",
            repo: "",
            branch: "main",
            imagesPath: "cards"
        };

        const supplied = window.CARDS_GALLERY_CONFIG || {};
        const merged = {
            owner: supplied.owner || defaults.owner,
            repo: supplied.repo || defaults.repo,
            branch: supplied.branch || defaults.branch,
            imagesPath: supplied.imagesPath || defaults.imagesPath
        };

        if (!merged.owner || !merged.repo) {
            const inferred = inferGitHubProject();
            if (inferred) {
                merged.owner = merged.owner || inferred.owner;
                merged.repo = merged.repo || inferred.repo;
            }
        }

        return merged;
    }

    function inferGitHubProject() {
        const host = window.location.hostname;
        const pathParts = window.location.pathname.split("/").filter(Boolean);

        if (host.endsWith(".github.io")) {
            const owner = host.replace(".github.io", "");

            if (pathParts.length > 0) {
                return { owner, repo: pathParts[0] };
            }
        }

        return null;
    }

    function setStatus(message, isError) {
        statusEl.textContent = message;
        statusEl.classList.toggle("error", !!isError);
    }

    async function loadCards() {
        if (!config.owner || !config.repo) {
            setStatus("Missing config: set owner and repo in window.CARDS_GALLERY_CONFIG.", true);
            return;
        }

        setStatus("Loading cards...", false);
        galleryEl.innerHTML = "";

        try {
            const files = await fetchFolderContents(config);
            const cardEntries = pairCardImages(files);

            if (cardEntries.length === 0) {
                setStatus("No matching card images found. Expected files like player-front.jpg and player-back.jpg.", true);
                return;
            }

            renderCards(cardEntries);
            setStatus(`Loaded ${cardEntries.length} card${cardEntries.length === 1 ? "" : "s"}.`, false);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setStatus(`Could not load cards: ${message}`, true);
        }
    }

    async function fetchFolderContents(currentConfig) {
        const path = encodeURIComponent(currentConfig.imagesPath).replace(/%2F/g, "/");
        const apiUrl = `https://api.github.com/repos/${currentConfig.owner}/${currentConfig.repo}/contents/${path}?ref=${encodeURIComponent(currentConfig.branch)}`;

        const response = await fetch(apiUrl, {
            headers: {
                Accept: "application/vnd.github+json"
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Folder '${currentConfig.imagesPath}' was not found in ${currentConfig.owner}/${currentConfig.repo} (${currentConfig.branch}).`);
            }

            if (response.status === 403) {
                throw new Error("GitHub API rate limit hit. Try again later.");
            }

            throw new Error(`GitHub API returned ${response.status}.`);
        }

        const payload = await response.json();
        if (!Array.isArray(payload)) {
            throw new Error("GitHub API response was not a file list.");
        }

        return payload.filter((item) => item.type === "file");
    }

    function pairCardImages(files) {
        const cardMap = new Map();
        const pattern = /^(.+)-(front|back)\.[a-z0-9]+$/i;

        for (const file of files) {
            const match = file.name.match(pattern);
            if (!match) {
                continue;
            }

            const key = match[1];
            const side = match[2].toLowerCase();

            if (!cardMap.has(key)) {
                cardMap.set(key, { key, front: null, back: null });
            }

            const entry = cardMap.get(key);
            entry[side] = file.download_url;
        }

        return Array.from(cardMap.values()).sort((a, b) => {
            return a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: "base" });
        });
    }

    function renderCards(cardEntries) {
        const fragment = document.createDocumentFragment();

        cardEntries.forEach((entry, index) => {
            const card = document.createElement("article");
            card.className = "card";
            card.style.animationDelay = `${Math.min(index * 20, 280)}ms`;

            const header = document.createElement("div");
            header.className = "card-header";
            header.textContent = entry.key;

            const thumbs = document.createElement("div");
            thumbs.className = "thumbs";

            thumbs.appendChild(createThumb(entry.front, "Front"));
            thumbs.appendChild(createThumb(entry.back, "Back"));

            card.appendChild(header);
            card.appendChild(thumbs);
            fragment.appendChild(card);
        });

        galleryEl.appendChild(fragment);
    }

    function createThumb(url, caption) {
        const figure = document.createElement("figure");

        if (url) {
            const img = document.createElement("img");
            img.src = url;
            img.alt = `${caption} image`;
            img.loading = "lazy";

            figure.appendChild(img);
        } else {
            const missing = document.createElement("div");
            missing.className = "missing";
            missing.textContent = `${caption} image missing`;
            figure.appendChild(missing);
        }

        const figcaption = document.createElement("figcaption");
        figcaption.textContent = caption;
        figure.appendChild(figcaption);

        return figure;
    }

    reloadBtn.addEventListener("click", loadCards);
    loadCards();
})();