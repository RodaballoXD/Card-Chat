export function captureInteractiveState(appEl: HTMLElement): PreservedInteractiveState {
    const activeElement = document.activeElement;
    let activeInputKey: string | null = null;
    const inputs: PreservedInputState[] = [];

    getPreservableInputs(appEl).forEach((input, index) => {
        const key = getPreservedInputKey(input, index);
        if (!key) return;

        inputs.push({
            key,
            value: input.value,
            checked: input instanceof HTMLInputElement ? input.checked : undefined,
            selectionStart: input.selectionStart,
            selectionEnd: input.selectionEnd,
        });

        if (input === activeElement) {
            activeInputKey = key;
        }
    });

    return {
        activeInputKey,
        inputs,
        scrollContainers: getPreservableScrollContainers(appEl).map((element, index) => ({
            key: getPreservedScrollKey(element, index),
            scrollLeft: element.scrollLeft,
            scrollTop: element.scrollTop,
        })),
        panels: getPreservablePanels(appEl).map((element) => ({
            key: element.getAttribute("data-panel") ?? "",
            hidden: element.hasAttribute("hidden"),
        })),
    };
}

export function restoreInteractiveState(appEl: HTMLElement, state: PreservedInteractiveState) {
    const preservedInputs = new Map(state.inputs.map((input) => [input.key, input]));
    getPreservableInputs(appEl).forEach((input, index) => {
        const key = getPreservedInputKey(input, index);
        if (!key) return;

        const preserved = preservedInputs.get(key);
        if (!preserved) return;

        input.value = preserved.value;
        if (input instanceof HTMLInputElement && preserved.checked !== undefined) {
            input.checked = preserved.checked;
        }

        if (preserved.selectionStart !== null && preserved.selectionEnd !== null) {
            input.setSelectionRange(preserved.selectionStart, preserved.selectionEnd);
        }

        updateInputCounter(appEl, input);
        if (key === state.activeInputKey) {
            input.focus();
        }
    });

    const preservedScrollContainers = new Map(state.scrollContainers.map((container) => [container.key, container]));
    getPreservableScrollContainers(appEl).forEach((element, index) => {
        const preserved = preservedScrollContainers.get(getPreservedScrollKey(element, index));
        if (!preserved) return;

        element.scrollLeft = preserved.scrollLeft;
        element.scrollTop = preserved.scrollTop;
    });

    const preservedPanels = new Map(state.panels.map((panel) => [panel.key, panel]));
    getPreservablePanels(appEl).forEach((element) => {
        const key = element.getAttribute("data-panel") ?? "";
        const preserved = preservedPanels.get(key);
        if (!preserved) return;

        if (preserved.hidden) {
            element.setAttribute("hidden", "true");
        } else {
            element.removeAttribute("hidden");
        }
    });
}

export function updateCharCounter(appEl: HTMLElement, input: HTMLInputElement, key: string) {
    const counter = appEl.querySelector(`[data-char-counter="${key}"]`) as HTMLElement | null;
    if (!counter) return;

    const length = input.value.length;
    counter.textContent = `${length}/100`;
    counter.classList.toggle("over-limit", length > 100);
}

function updateInputCounter(appEl: HTMLElement, input: HTMLInputElement | HTMLTextAreaElement) {
    const action = input.getAttribute("data-action");
    if (action === "create-card-input") {
        updateCharCounter(appEl, input as HTMLInputElement, "create-card");
    } else if (action === "create-conversation-input") {
        updateCharCounter(appEl, input as HTMLInputElement, "create-conversation");
    }
}

function getPreservableInputs(appEl: HTMLElement): Array<HTMLInputElement | HTMLTextAreaElement> {
    return Array.from(appEl.querySelectorAll("input, textarea"))
        .filter((input): input is HTMLInputElement | HTMLTextAreaElement => (
            input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement
        ));
}

function getPreservableScrollContainers(appEl: HTMLElement): HTMLElement[] {
    return Array.from(appEl.querySelectorAll(".hand-list"))
        .filter((element): element is HTMLElement => element instanceof HTMLElement);
}

function getPreservablePanels(appEl: HTMLElement): HTMLElement[] {
    return Array.from(appEl.querySelectorAll("[data-panel]"))
        .filter((element): element is HTMLElement => element instanceof HTMLElement);
}

function getPreservedInputKey(input: HTMLInputElement | HTMLTextAreaElement, index = 0): string | null {
    const action = input.getAttribute("data-action");
    if (action) return `action:${action}`;

    if (input.id) return `id:${input.id}`;
    if (input.name) return `name:${input.name}`;
    return `index:${index}`;
}

function getPreservedScrollKey(element: HTMLElement, index: number): string {
    const action = element.getAttribute("data-action");
    if (action) return `action:${action}`;

    const panel = element.closest("[data-panel]")?.getAttribute("data-panel");
    if (panel) return `panel:${panel}`;

    if (element.classList.contains("hand-list")) return "class:hand-list";
    return `index:${index}`;
}

type PreservedInputState = {
    key: string;
    value: string;
    checked: boolean | undefined;
    selectionStart: number | null;
    selectionEnd: number | null;
};

type PreservedScrollState = {
    key: string;
    scrollLeft: number;
    scrollTop: number;
};

type PreservedPanelState = {
    key: string;
    hidden: boolean;
};

export type PreservedInteractiveState = {
    activeInputKey: string | null;
    inputs: PreservedInputState[];
    scrollContainers: PreservedScrollState[];
    panels: PreservedPanelState[];
};
