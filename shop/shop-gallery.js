(function () {
    "use strict";

    const sourcesPath = "shop-sources.json";
    const statusEl = document.getElementById("status");
    const galleryEl = document.getElementById("gallery");
    const emptyStateEl = document.getElementById("empty-state");
    const searchInputEl = document.getElementById("search-input");
    const sortSelectEl = document.getElementById("sort-select");
    const clearSearchBtn = document.getElementById("clear-search");
    const sourceCountEl = document.getElementById("source-count");
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
        statusEl.style.display = "block";
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

    function sortCards(cards, sortMode) {
        return [...cards].sort((left, right) => compareArrays(getSortValue(left, sortMode), getSortValue(right, sortMode)));
    }

    function getVisibleCards() {
        const query = clean(searchInputEl?.value || "").toLowerCase();
        const sortMode = sortSelectEl?.value || "newest";

        let cards = state.cards;

        if (query) {
            cards = cards.filter((card) => card.searchText.includes(query));
        }

        cards = sortCards(cards, sortMode);
        return cards;
    }

    function renderCards() {
        state.filteredCards = getVisibleCards();

        if (!galleryEl) {
            return;
        }

        galleryEl.innerHTML = "";

        if (state.filteredCards.length === 0) {
            emptyStateEl.hidden = false;
            return;
        }

        emptyStateEl.hidden = true;

        const fragment = document.createDocumentFragment();

        state.filteredCards.forEach((card) => {
            const article = document.createElement("article");
            article.className = "card";

            const media = document.createElement("div");
            media.className = "card-media";

            const image = document.createElement("img");
            image.src = card.frontImage || card.backImage || "";
            image.alt = card.title;
            image.loading = "lazy";
            if (!card.frontImage && card.backImage) {
                image.src = card.backImage;
            }
            media.appendChild(image);

            const body = document.createElement("div");
            body.className = "card-body";

            const title = document.createElement("h2");
            title.className = "card-title";
            title.textContent = card.title;

            const meta = document.createElement("p");
            meta.className = "card-meta";
            meta.textContent = [card.player, card.brand, card.setName, card.cardNumber].filter(Boolean).join(" • ");

            const price = document.createElement("p");
            price.className = "card-price";
            price.textContent = card.salePrice != null ? currencyFormatter.format(card.salePrice) : "Price on request";

            const note = document.createElement("p");
            note.className = "card-note";
            note.textContent = card.note ? card.note.replace(/<[^>]+>/g, " ").trim() : "";

            const actions = document.createElement("div");
            actions.className = "card-actions";

            const viewButton = document.createElement("button");
            viewButton.className = "card-action";
            viewButton.type = "button";
            viewButton.textContent = "View details";
            viewButton.addEventListener("click", () => openModal(card));

            actions.appendChild(viewButton);
            body.appendChild(title);
            body.appendChild(meta);
            body.appendChild(price);
            if (note.textContent) {
                body.appendChild(note);
            }
            body.appendChild(actions);
            article.appendChild(media);
            article.appendChild(body);
            fragment.appendChild(article);
        });

        galleryEl.appendChild(fragment);
    }

    function setModalCard(card) {
        state.modalCard = card;
        if (!card) {
            modalEl.setAttribute("aria-hidden", "true");
            return;
        }

        modalTitleEl.textContent = card.title;
        modalCaptionEl.textContent = [card.player, card.brand, card.setName, card.cardNumber, card.gradeName, card.gradeNumber].filter(Boolean).join(" • ");
        modalImageEl.src = state.modalSide === "back" && card.backImage ? card.backImage : card.frontImage || card.backImage || "";
        modalImageEl.alt = `${card.title} ${state.modalSide}`;
        modalControlsEl.innerHTML = "";

        const sideButtons = [];
        if (card.frontImage) {
            sideButtons.push({ label: "Front", value: "front" });
        }
        if (card.backImage) {
            sideButtons.push({ label: "Back", value: "back" });
        }

        sideButtons.forEach((buttonData) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = buttonData.label;
            button.addEventListener("click", () => {
                state.modalSide = buttonData.value;
                setModalCard(card);
            });
            modalControlsEl.appendChild(button);
        });

        modalEl.setAttribute("aria-hidden", "false");
    }

    function openModal(card) {
        state.modalSide = "front";
        setModalCard(card);
    }

    function closeModal() {
        state.modalCard = null;
        modalEl.setAttribute("aria-hidden", "true");
    }

    async function loadSources() {
        setStatus("Loading shop inventory…");

        try {
            const response = await fetch(sourcesPath, { cache: "no-store" });
            if (!response.ok) {
                throw new Error(`Unable to load source list (${response.status})`);
            }

            const manifest = await response.json();
            const sourceUrls = Array.isArray(manifest.sources) ? manifest.sources : [];
            if (sourceCountEl) {
                sourceCountEl.textContent = `${sourceUrls.length} batch${sourceUrls.length === 1 ? "" : "es"} loaded from the manifest`;
            }

            if (sourceUrls.length === 0) {
                setStatus("No card sources were found in the manifest.", true);
                return;
            }

            const csvTexts = await Promise.all(sourceUrls.map(async (sourceUrl) => {
                const csvResponse = await fetch(sourceUrl, { cache: "no-store" });
                if (!csvResponse.ok) {
                    throw new Error(`Unable to load ${sourceUrl}`);
                }
                return csvResponse.text();
            }));

            const loadedCards = csvTexts.flatMap((text) => normalizeCards(text));
            state.cards = loadedCards;
            renderCards();
            setStatus(`Loaded ${loadedCards.length} cards across ${sourceUrls.length} source${sourceUrls.length === 1 ? "" : "s"}.`);
        } catch (error) {
            console.error(error);
            setStatus(`Unable to load shop inventory: ${error.message}`, true);
        }
    }

    function bindEvents() {
        searchInputEl?.addEventListener("input", renderCards);
        sortSelectEl?.addEventListener("change", renderCards);
        clearSearchBtn?.addEventListener("click", () => {
            if (searchInputEl) {
                searchInputEl.value = "";
            }
            renderCards();
        });
        modalCloseBtn?.addEventListener("click", closeModal);
        modalEl?.addEventListener("click", (event) => {
            if (event.target === modalEl) {
                closeModal();
            }
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                closeModal();
            }
        });
    }

    bindEvents();
    loadSources();
})();
