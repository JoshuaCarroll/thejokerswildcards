(function () {
    "use strict";

    const statusEl = document.getElementById("status");
    const galleryEl = document.getElementById("gallery");
    const reloadBtn = document.getElementById("reload-btn");
    const modalEl = document.getElementById("image-modal");
    const modalImageEl = document.getElementById("modal-image");
    const modalCaptionEl = document.getElementById("modal-caption");
    const modalCloseBtn = document.getElementById("modal-close");
    let modalCardState = null;

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

            thumbs.appendChild(createThumb(entry.front, "Front", entry.key));
            thumbs.appendChild(createThumb(entry.back, "Back", entry.key));

            card.appendChild(header);
            card.appendChild(thumbs);
            fragment.appendChild(card);
        });

        galleryEl.appendChild(fragment);
    }

    function createThumb(url, caption, cardName) {
        const figure = document.createElement("figure");
        const side = caption.toLowerCase();

        if (url) {
            const img = document.createElement("img");
            img.src = url;
            img.alt = `${cardName} ${caption}`;
            img.loading = "lazy";
            img.dataset.fullsizeUrl = url;
            img.dataset.modalCaption = `${cardName} - ${caption}`;
            img.dataset.cardName = cardName;
            img.dataset.side = side;

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

    function openModal(imageUrl, caption) {
        if (!modalEl || !modalImageEl || !modalCaptionEl) {
            return;
        }

        modalImageEl.src = imageUrl;
        modalImageEl.alt = caption;
        modalCaptionEl.textContent = caption;
        modalEl.classList.add("open");
        modalEl.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
    }

    function openModalFromThumb(thumbImage) {
        const side = thumbImage.dataset.side === "back" ? "back" : "front";
        const cardName = thumbImage.dataset.cardName || "Card";

        const siblingImages = thumbImage.closest(".thumbs")?.querySelectorAll("img") || [];
        let frontUrl = null;
        let backUrl = null;

        siblingImages.forEach((img) => {
            const siblingSide = img.dataset.side;
            if (siblingSide === "front") {
                frontUrl = img.dataset.fullsizeUrl || null;
            }
            if (siblingSide === "back") {
                backUrl = img.dataset.fullsizeUrl || null;
            }
        });

        modalCardState = {
            cardName,
            frontUrl,
            backUrl,
            currentSide: side
        };

        const urlToOpen = side === "back" ? backUrl : frontUrl;
        const caption = `${cardName} - ${side === "back" ? "Back" : "Front"}`;
        if (urlToOpen) {
            openModal(urlToOpen, caption);
        }
    }

    function flipModalCardSide() {
        if (!modalCardState || !modalImageEl || !modalCaptionEl) {
            return;
        }

        const oppositeSide = modalCardState.currentSide === "front" ? "back" : "front";
        const oppositeUrl = oppositeSide === "front" ? modalCardState.frontUrl : modalCardState.backUrl;
        if (!oppositeUrl) {
            return;
        }

        modalCardState.currentSide = oppositeSide;
        modalImageEl.src = oppositeUrl;
        modalImageEl.alt = `${modalCardState.cardName} - ${oppositeSide === "front" ? "Front" : "Back"}`;
        modalCaptionEl.textContent = `${modalCardState.cardName} - ${oppositeSide === "front" ? "Front" : "Back"}`;
    }

    function closeModal() {
        if (!modalEl || !modalImageEl || !modalCaptionEl) {
            return;
        }

        modalEl.classList.remove("open");
        modalEl.setAttribute("aria-hidden", "true");
        modalImageEl.src = "";
        modalImageEl.alt = "";
        modalCaptionEl.textContent = "";
        modalCardState = null;
        document.body.classList.remove("modal-open");
    }

    galleryEl.addEventListener("click", function (event) {
        const target = event.target;
        if (!(target instanceof HTMLImageElement)) {
            return;
        }

        const fullsizeUrl = target.dataset.fullsizeUrl;
        if (!fullsizeUrl) {
            return;
        }

        openModalFromThumb(target);
    });

    if (modalImageEl) {
        modalImageEl.addEventListener("click", function () {
            flipModalCardSide();
        });
    }

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener("click", closeModal);
    }

    if (modalEl) {
        modalEl.addEventListener("click", function (event) {
            if (event.target === modalEl) {
                closeModal();
            }
        });
    }

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && modalEl && modalEl.classList.contains("open")) {
            closeModal();
        }
    });

    reloadBtn.addEventListener("click", loadCards);
    loadCards();
})();