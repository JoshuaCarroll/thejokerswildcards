(function () {
    "use strict";

    // "../cards.csv"
    const csvPath = "https://v2.carddealerpro.com/v2/users/47648/batches/1235969/download?csv_only=1";

    const statusEl = document.getElementById("status");
    const galleryEl = document.getElementById("gallery");
    const emptyStateEl = document.getElementById("empty-state");
    const reloadBtn = document.getElementById("reload-btn");
    const searchInputEl = document.getElementById("search-input");
    const sortSelectEl = document.getElementById("sort-select");
    const clearSearchBtn = document.getElementById("clear-search");
    const statTotalEl = document.getElementById("stat-total");
    const statYearsEl = document.getElementById("stat-years");
    const statFrontsEl = document.getElementById("stat-fronts");
    const statBacksEl = document.getElementById("stat-backs");
    const modalEl = document.getElementById("image-modal");
    const modalImageEl = document.getElementById("modal-image");
    const modalTitleEl = document.getElementById("modal-title");
    const modalCaptionEl = document.getElementById("modal-caption");
    const modalCloseBtn = document.getElementById("modal-close");
    const modalControlsEl = document.getElementById("modal-controls");

    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2
    });

    const state = {
        cards: [],
        filteredCards: [],
        modalCard: null,
        modalSide: "front"
    };

    function setStatus(message, isError) {
        if (!statusEl) {
            return;
        }

        statusEl.textContent = message;
        statusEl.classList.toggle("error", !!isError);
    }

    function clean(value) {
        return value == null ? "" : String(value).trim();
    }

    function toNumber(value) {
        const cleaned = clean(value).replace(/[^0-9.-]/g, "");
        if (!cleaned) {
            return null;
        }

        const parsed = Number.parseFloat(cleaned);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function parseCsv(text) {
        const rows = [];
        let row = [];
        let field = "";
        let index = 0;
        let inQuotes = false;

        while (index < text.length) {
            const char = text[index];

            if (inQuotes) {
                if (char === '"') {
                    if (text[index + 1] === '"') {
                        field += '"';
                        index += 2;
                        continue;
                    }

                    inQuotes = false;
                    index += 1;
                    continue;
                }

                field += char;
                index += 1;
                continue;
            }

            if (char === '"') {
                inQuotes = true;
                index += 1;
                continue;
            }

            if (char === ",") {
                row.push(field);
                field = "";
                index += 1;
                continue;
            }

            if (char === "\n") {
                row.push(field);
                rows.push(row);
                row = [];
                field = "";
                index += 1;
                continue;
            }

            if (char === "\r") {
                index += 1;
                continue;
            }

            field += char;
            index += 1;
        }

        if (field.length || row.length) {
            row.push(field);
            rows.push(row);
        }

        return rows;
    }

    function createHeaderLookup(headers) {
        const lookup = new Map();

        headers.forEach((header, index) => {
            lookup.set(header.trim().toLowerCase(), index);
        });

        return lookup;
    }

    function getField(row, lookup, name) {
        const index = lookup.get(name);
        if (index == null) {
            return "";
        }

        return clean(row[index]);
    }

    function normalizeCards(csvText) {
        const rows = parseCsv(csvText);
        if (rows.length === 0) {
            return [];
        }

        const [headerRow, ...dataRows] = rows;
        const lookup = createHeaderLookup(headerRow);

        return dataRows
            .map((row, index) => {
                const title = getField(row, lookup, "title");
                const player = getField(row, lookup, "player");
                const year = getField(row, lookup, "year");
                const brand = getField(row, lookup, "brand");
                const setName = getField(row, lookup, "set");
                const subset = getField(row, lookup, "subset");
                const team = getField(row, lookup, "team");
                const cardNumber = getField(row, lookup, "card_number");
                const gradeName = getField(row, lookup, "grade_name");
                const gradeNumber = getField(row, lookup, "grade_number");
                const salePrice = toNumber(getField(row, lookup, "sale_price"));
                const marketPrice = toNumber(getField(row, lookup, "market_price"));
                const note = getField(row, lookup, "note");
                const frontImage = getField(row, lookup, "front_image");
                const backImage = getField(row, lookup, "back_image");

                const resolvedTitle = title || [player, setName, cardNumber].filter(Boolean).join(" ") || `Card ${index + 1}`;

                return {
                    id: `${resolvedTitle}-${index}`,
                    title: resolvedTitle,
                    player,
                    year,
                    brand,
                    setName,
                    subset,
                    team,
                    cardNumber,
                    gradeName,
                    gradeNumber,
                    salePrice,
                    marketPrice,
                    note,
                    frontImage,
                    backImage,
                    searchText: [
                        resolvedTitle,
                        player,
                        year,
                        brand,
                        setName,
                        subset,
                        team,
                        cardNumber,
                        gradeName,
                        gradeNumber,
                        note
                    ].filter(Boolean).join(" ").toLowerCase(),
                    sortTitle: resolvedTitle.toLowerCase(),
                    sortPlayer: player.toLowerCase(),
                    sortBrand: brand.toLowerCase(),
                    sortYear: Number.parseInt(year, 10) || 0,
                    imageCount: Number(Boolean(frontImage)) + Number(Boolean(backImage))
                };
            })
            .filter((card) => card.title || card.frontImage || card.backImage);
    }

    function getSortValue(card, sortMode) {
        switch (sortMode) {
            case "oldest":
                return [card.sortYear || Number.MAX_SAFE_INTEGER, card.sortTitle];
            case "title":
                return [card.sortTitle, card.sortYear ? -card.sortYear : 0];
            case "player":
                return [card.sortPlayer || card.sortTitle, card.sortTitle];
            case "brand":
                return [card.sortBrand || card.sortTitle, card.sortTitle];
            case "newest":
            default:
                return [card.sortYear ? -card.sortYear : Number.MAX_SAFE_INTEGER, card.sortTitle];
        }
    }

    function compareArrays(left, right) {
        const maxLength = Math.max(left.length, right.length);

        for (let index = 0; index < maxLength; index += 1) {
            const leftValue = left[index];
            const rightValue = right[index];

            if (leftValue === rightValue) {
                continue;
            }

            if (typeof leftValue === "number" && typeof rightValue === "number") {
                return leftValue - rightValue;
            }

            return String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: "base" });
        }

        return 0;
    }

    function formatMoney(value) {
        if (value == null) {
            return "";
        }

        return currencyFormatter.format(value);
    }

    function buildChips(card) {
        const chips = [];

        if (card.year) {
            chips.push(card.year);
        }

        if (card.brand) {
            chips.push(card.brand);
        }

        if (card.setName) {
            chips.push(card.setName);
        }

        if (card.team) {
            chips.push(card.team);
        }

        if (card.gradeName) {
            chips.push(`${card.gradeName}${card.gradeNumber ? ` ${card.gradeNumber}` : ""}`.trim());
        }

        if (card.cardNumber) {
            chips.push(`#${card.cardNumber}`);
        }

        return chips.slice(0, 4);
    }

    function createImageButton(card, side) {
        const imageUrl = side === "front" ? card.frontImage : card.backImage;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "image-button";
        button.dataset.cardId = card.id;
        button.dataset.side = side;

        if (!imageUrl) {
            const missing = document.createElement("div");
            missing.className = "image-missing";
            missing.textContent = `${side === "front" ? "Front" : "Back"} image missing`;
            button.appendChild(missing);
            button.disabled = true;
            button.style.cursor = "default";
            return button;
        }

        const frame = document.createElement("div");
        frame.className = "image-frame";
        frame.dataset.side = side === "front" ? "Front" : "Back";

        const img = document.createElement("img");
        img.src = imageUrl;
        img.alt = `${card.title} ${side === "front" ? "front" : "back"}`;
        img.loading = "lazy";
        img.decoding = "async";
        img.referrerPolicy = "no-referrer";

        frame.appendChild(img);
        button.appendChild(frame);
        return button;
    }

    function renderCards(cards) {
        if (!galleryEl) {
            return;
        }

        galleryEl.innerHTML = "";

        const fragment = document.createDocumentFragment();

        cards.forEach((card, index) => {
            const article = document.createElement("article");
            article.className = "collection-card";
            article.style.animationDelay = `${Math.min(index * 30, 300)}ms`;
            article.dataset.cardId = card.id;

            const header = document.createElement("div");

            const title = document.createElement("h2");
            title.className = "collection-title";
            title.textContent = card.title;

            const subtitle = document.createElement("p");
            subtitle.className = "collection-subtitle";
            subtitle.textContent = [card.player, card.subset, card.note].filter(Boolean).join(" · ");

            header.appendChild(title);
            header.appendChild(subtitle);

            const chips = document.createElement("div");
            chips.className = "chips";

            buildChips(card).forEach((chipLabel) => {
                const chip = document.createElement("span");
                chip.className = "chip";
                chip.textContent = chipLabel;
                chips.appendChild(chip);
            });

            const imageGrid = document.createElement("div");
            imageGrid.className = "image-grid";
            imageGrid.appendChild(createImageButton(card, "front"));

            /*
            const footer = document.createElement("div");
            footer.className = "card-footer";

            const imageCount = document.createElement("span");
            imageCount.textContent = `${card.imageCount} image${card.imageCount === 1 ? "" : "s"}`;

            const price = document.createElement("span");
            price.className = "price";
            price.textContent = formatMoney(card.marketPrice) || formatMoney(card.salePrice) || "";

            footer.appendChild(imageCount);
            if (price.textContent) {
                footer.appendChild(price);
            }
            */

            article.appendChild(header);
            article.appendChild(chips);
            article.appendChild(imageGrid);
            // article.appendChild(footer);
            fragment.appendChild(article);
        });

        galleryEl.appendChild(fragment);
    }

    function updateStats(cards) {
        const total = cards.length;
        const years = new Set(cards.map((card) => card.year).filter(Boolean));
        const fronts = cards.filter((card) => card.frontImage).length;
        const backs = cards.filter((card) => card.backImage).length;

        if (statTotalEl) {
            statTotalEl.textContent = String(total);
        }

        if (statYearsEl) {
            statYearsEl.textContent = String(years.size);
        }

        if (statFrontsEl) {
            statFrontsEl.textContent = String(fronts);
        }

        if (statBacksEl) {
            statBacksEl.textContent = String(backs);
        }
    }

    function applyFilters() {
        const searchTerm = clean(searchInputEl?.value).toLowerCase();
        const sortMode = sortSelectEl?.value || "newest";

        const filtered = state.cards.filter((card) => {
            if (!searchTerm) {
                return true;
            }

            return card.searchText.includes(searchTerm);
        });

        filtered.sort((left, right) => compareArrays(getSortValue(left, sortMode), getSortValue(right, sortMode)));

        state.filteredCards = filtered;
        renderCards(filtered);
        updateStats(state.cards);

        if (emptyStateEl) {
            emptyStateEl.hidden = filtered.length !== 0;
        }
    }

    function getCardById(cardId) {
        return state.cards.find((card) => card.id === cardId) || null;
    }

    function setModalControls(card, activeSide) {
        if (!modalControlsEl) {
            return;
        }

        modalControlsEl.innerHTML = "";

        ["front", "back"].forEach((side) => {
            const imageUrl = side === "front" ? card.frontImage : card.backImage;
            if (!imageUrl) {
                return;
            }

            const button = document.createElement("button");
            button.type = "button";
            button.className = side === activeSide ? "modal-pill active" : "modal-pill";
            button.textContent = side === "front" ? "Front" : "Back";
            button.addEventListener("click", () => openModal(card, side));
            modalControlsEl.appendChild(button);
        });
    }

    function openModal(card, side) {
        if (!modalEl || !modalImageEl || !modalTitleEl || !modalCaptionEl) {
            return;
        }

        const imageUrl = side === "front" ? card.frontImage : card.backImage;
        if (!imageUrl) {
            return;
        }

        state.modalCard = card;
        state.modalSide = side;

        modalImageEl.src = imageUrl;
        modalImageEl.alt = `${card.title} ${side}`;
        modalTitleEl.textContent = card.title;
        modalCaptionEl.textContent = [card.player, card.year, card.brand, side === "front" ? "Front" : "Back"].filter(Boolean).join(" · ");
        setModalControls(card, side);

        modalEl.classList.add("open");
        modalEl.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
    }

    function flipModalSide() {
        if (!state.modalCard) {
            return;
        }

        const nextSide = state.modalSide === "front" ? "back" : "front";
        const nextUrl = nextSide === "front" ? state.modalCard.frontImage : state.modalCard.backImage;

        if (!nextUrl) {
            return;
        }

        openModal(state.modalCard, nextSide);
    }

    function closeModal() {
        if (!modalEl || !modalImageEl || !modalTitleEl || !modalCaptionEl) {
            return;
        }

        modalEl.classList.remove("open");
        modalEl.setAttribute("aria-hidden", "true");
        modalImageEl.src = "";
        modalImageEl.alt = "";
        modalTitleEl.textContent = "";
        modalCaptionEl.textContent = "";
        if (modalControlsEl) {
            modalControlsEl.innerHTML = "";
        }

        state.modalCard = null;
        document.body.classList.remove("modal-open");
    }

    async function loadCards({ bustCache = false } = {}) {
        if (!galleryEl) {
            return;
        }

        setStatus("Loading cards from csv...", false);
        galleryEl.innerHTML = "";

        try {
            const variableSeparator = csvPath.contains("?") ? "&" : "?";
            const csvUrl = bustCache ? `${csvPath}${variableSeparator}ts=${Date.now()}` : csvPath;
            const response = await fetch(csvUrl, { cache: "no-store" });

            if (!response.ok) {
                throw new Error(`CSV fetch returned ${response.status}.`);
            }

            const csvText = await response.text();
            const cards = normalizeCards(csvText);

            if (cards.length === 0) {
                state.cards = [];
                state.filteredCards = [];
                updateStats([]);
                setStatus("csv loaded, but no rows contained card data.", true);
                if (emptyStateEl) {
                    emptyStateEl.hidden = false;
                }
                return;
            }

            state.cards = cards;
            applyFilters();
            setStatus(``, false);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            state.cards = [];
            state.filteredCards = [];
            updateStats([]);
            setStatus(`Could not load cards: ${message}`, true);
            if (emptyStateEl) {
                emptyStateEl.hidden = false;
            }
        }
    }

    galleryEl?.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const button = target.closest("button[data-card-id]");
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }

        const cardId = button.dataset.cardId;
        const side = button.dataset.side === "back" ? "back" : "front";
        const card = cardId ? getCardById(cardId) : null;

        if (!card) {
            return;
        }

        openModal(card, side);
    });

    modalImageEl?.addEventListener("click", () => {
        flipModalSide();
    });

    modalCloseBtn?.addEventListener("click", closeModal);

    modalEl?.addEventListener("click", (event) => {
        if (event.target === modalEl) {
            closeModal();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (!modalEl || !modalEl.classList.contains("open")) {
            return;
        }

        if (event.key === "Escape") {
            closeModal();
            return;
        }

        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            flipModalSide();
        }
    });

    searchInputEl?.addEventListener("input", applyFilters);
    sortSelectEl?.addEventListener("change", applyFilters);
    clearSearchBtn?.addEventListener("click", () => {
        if (searchInputEl) {
            searchInputEl.value = "";
        }

        if (sortSelectEl) {
            sortSelectEl.value = "newest";
        }

        applyFilters();
    });

    reloadBtn?.addEventListener("click", () => loadCards({ bustCache: true }));
    loadCards();
})();