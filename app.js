"use strict";

/*
 * Paste your Google Apps Script web app URL here.
 * The URL must end with /exec.
 */
const GOOGLE_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbydZiu9GL-1Ip7g_231i00VjrYpLyriOBogEmcCAc3JLBIICzE7ao_qJ0_LvxD2xvEN/exec";

const movieForm =
    document.getElementById("movieForm");

const movieTitleInput =
    document.getElementById("movieTitle");

const movieFormatInput =
    document.getElementById("movieFormat");

const damienWantsInput =
    document.getElementById(
        "damienWantsInput"
    );

const lisaWantsInput =
    document.getElementById(
        "lisaWantsInput"
    );

const pickMovieButton =
    document.getElementById(
        "pickMovieButton"
    );

const selectedMovieElement =
    document.getElementById(
        "selectedMovie"
    );

const movieListElement =
    document.getElementById(
        "movieList"
    );

const movieCountElement =
    document.getElementById(
        "movieCount"
    );

const emptyMessageElement =
    document.getElementById(
        "emptyMessage"
    );

const searchInput =
    document.getElementById(
        "searchInput"
    );

const preferenceFilter =
    document.getElementById(
        "preferenceFilter"
    );

const pickerPreference =
    document.getElementById(
        "pickerPreference"
    );

const addMovieButton =
    movieForm.querySelector(
        'button[type="submit"]'
    );

let movies = [];
let lastSelectedMovieId = null;

/**
 * Checks whether the Google Script URL
 * has been added correctly.
 */
function isGoogleScriptConfigured() {
    return (
        GOOGLE_SCRIPT_URL.startsWith(
            "https://"
        ) &&
        GOOGLE_SCRIPT_URL.endsWith(
            "/exec"
        )
    );
}

/**
 * Loads movies from Google Sheets.
 */
async function loadMovies() {
    if (!isGoogleScriptConfigured()) {
        showLibraryMessage(
            "Add your Google Apps Script URL inside app.js."
        );

        return;
    }

    setLoadingState(true);

    showLibraryMessage(
        "Loading movies..."
    );

    try {
        const response = await fetch(
            GOOGLE_SCRIPT_URL,
            {
                method: "GET",
                redirect: "follow"
            }
        );

        if (!response.ok) {
            throw new Error(
                `Google returned error ${response.status}.`
            );
        }

        const result =
            await response.json();

        if (!result.success) {
            throw new Error(
                result.message ||
                "Movies could not be loaded."
            );
        }

        movies = Array.isArray(
            result.movies
        )
            ? result.movies.map(
                normaliseMovie
            )
            : [];

        sortMovies();
        renderMovies();
    } catch (error) {
        console.error(
            "Could not load movies:",
            error
        );

        showLibraryMessage(
            "The movie library could not be loaded. Check your Apps Script URL and deployment."
        );
    } finally {
        setLoadingState(false);
    }
}

/**
 * Ensures preference values are true
 * JavaScript booleans.
 */
function normaliseMovie(movie) {
    return {
        ...movie,

        damienWants:
            movie.damienWants === true,

        lisaWants:
            movie.lisaWants === true
    };
}

/**
 * Sends a request to Google Apps Script.
 */
async function sendGoogleRequest(
    requestData
) {
    const response = await fetch(
        GOOGLE_SCRIPT_URL,
        {
            method: "POST",

            /*
             * text/plain avoids an unnecessary
             * browser preflight request.
             */
            headers: {
                "Content-Type":
                    "text/plain;charset=utf-8"
            },

            body: JSON.stringify(
                requestData
            ),

            redirect: "follow"
        }
    );

    if (!response.ok) {
        throw new Error(
            `Google returned error ${response.status}.`
        );
    }

    return response.json();
}

/**
 * Adds a movie to Google Sheets.
 */
async function addMovie(
    title,
    format,
    damienWants,
    lisaWants
) {
    const cleanedTitle =
        title.trim();

    if (!cleanedTitle) {
        return;
    }

    setLoadingState(true);

    addMovieButton.textContent =
        "Adding...";

    try {
        const result =
            await sendGoogleRequest({
                action: "addMovie",
                title: cleanedTitle,
                format: format,
                damienWants: damienWants,
                lisaWants: lisaWants
            });

        if (!result.success) {
            throw new Error(
                result.message ||
                "The movie could not be added."
            );
        }

        movieTitleInput.value = "";

        damienWantsInput.checked =
            false;

        lisaWantsInput.checked =
            false;

        await loadMovies();

        movieTitleInput.focus();
    } catch (error) {
        console.error(
            "Could not add movie:",
            error
        );

        alert(error.message);
    } finally {
        addMovieButton.textContent =
            "Add Movie";

        setLoadingState(false);
    }
}

/**
 * Updates Damien and Lisa's preferences.
 */
async function updateMoviePreferences(
    movieId,
    damienWants,
    lisaWants
) {
    const movie = movies.find(
        (item) => {
            return item.id === movieId;
        }
    );

    if (!movie) {
        return;
    }

    const previousDamienValue =
        movie.damienWants;

    const previousLisaValue =
        movie.lisaWants;

    /*
     * Update the interface immediately.
     */
    movie.damienWants =
        damienWants;

    movie.lisaWants =
        lisaWants;

    renderMovies();

    try {
        const result =
            await sendGoogleRequest({
                action:
                    "updatePreferences",

                id: movieId,

                damienWants:
                    damienWants,

                lisaWants:
                    lisaWants
            });

        if (!result.success) {
            throw new Error(
                result.message ||
                "Preferences could not be saved."
            );
        }
    } catch (error) {
        /*
         * Restore the old values if
         * Google Sheets could not be updated.
         */
        movie.damienWants =
            previousDamienValue;

        movie.lisaWants =
            previousLisaValue;

        renderMovies();

        console.error(
            "Could not update preferences:",
            error
        );

        alert(error.message);
    }
}

/**
 * Deletes a movie from Google Sheets.
 */
async function deleteMovie(
    movieId
) {
    const movie = movies.find(
        (item) => {
            return item.id === movieId;
        }
    );

    if (!movie) {
        return;
    }

    const shouldDelete = confirm(
        `Remove "${movie.title}" from your library?`
    );

    if (!shouldDelete) {
        return;
    }

    setLoadingState(true);

    try {
        const result =
            await sendGoogleRequest({
                action: "deleteMovie",
                id: movieId
            });

        if (!result.success) {
            throw new Error(
                result.message ||
                "The movie could not be deleted."
            );
        }

        if (
            lastSelectedMovieId ===
            movieId
        ) {
            lastSelectedMovieId = null;

            selectedMovieElement.textContent =
                "No movie selected";
        }

        await loadMovies();
    } catch (error) {
        console.error(
            "Could not delete movie:",
            error
        );

        alert(error.message);
    } finally {
        setLoadingState(false);
    }
}

/**
 * Filters movies using a supplied preference.
 */
function filterMoviesByPreference(
    movieCollection,
    selectedFilter
) {
    return movieCollection.filter(
        (movie) => {
            switch (selectedFilter) {
                case "damien":
                    /*
                     * Damien only:
                     * Damien checked,
                     * Lisa unchecked.
                     */
                    return (
                        movie.damienWants &&
                        !movie.lisaWants
                    );

                case "lisa":
                    /*
                     * Lisa only:
                     * Lisa checked,
                     * Damien unchecked.
                     */
                    return (
                        movie.lisaWants &&
                        !movie.damienWants
                    );

                case "both":
                    /*
                     * Both Damien and Lisa checked.
                     */
                    return (
                        movie.damienWants &&
                        movie.lisaWants
                    );

                case "unselected":
                    /*
                     * Neither person checked.
                     */
                    return (
                        !movie.damienWants &&
                        !movie.lisaWants
                    );

                case "all":
                default:
                    return true;
            }
        }
    );
}

/**
 * Returns movies matching the library filter.
 */
function getFilteredMovies() {
    return filterMoviesByPreference(
        movies,
        preferenceFilter.value
    );
}

/**
 * Randomly chooses a movie using the
 * selector next to the Choose a Movie button.
 */
function chooseRandomMovie() {
    let availableMovies =
        filterMoviesByPreference(
            movies,
            pickerPreference.value
        );

    if (availableMovies.length === 0) {
        selectedMovieElement.textContent =
            "There are no movies in this list.";

        return;
    }

    /*
     * Avoid selecting the same movie twice
     * in a row when another option exists.
     */
    if (
        availableMovies.length > 1 &&
        lastSelectedMovieId
    ) {
        availableMovies =
            availableMovies.filter(
                (movie) => {
                    return (
                        movie.id !==
                        lastSelectedMovieId
                    );
                }
            );
    }

    const randomIndex = Math.floor(
        Math.random() *
        availableMovies.length
    );

    const selectedMovie =
        availableMovies[randomIndex];

    lastSelectedMovieId =
        selectedMovie.id;

    selectedMovieElement.textContent =
        `${selectedMovie.title} — ${selectedMovie.format}`;
}

/**
 * Sorts movies alphabetically.
 * A leading "The" is ignored.
 */
function sortMovies() {
    movies.sort(
        (
            firstMovie,
            secondMovie
        ) => {
            const firstTitle =
                createSortTitle(
                    firstMovie.title
                );

            const secondTitle =
                createSortTitle(
                    secondMovie.title
                );

            return firstTitle.localeCompare(
                secondTitle,
                undefined,
                {
                    numeric: true,
                    sensitivity: "base"
                }
            );
        }
    );
}

/**
 * Creates a title used for sorting only.
 */
function createSortTitle(title) {
    return title
        .replace(
            /^the\s+/i,
            ""
        )
        .trim();
}

/**
 * Displays the movie library.
 */
function renderMovies() {
    const searchText =
        searchInput.value
            .trim()
            .toLowerCase();

    const filteredMovies =
        getFilteredMovies();

    const visibleMovies =
        filteredMovies.filter(
            (movie) => {
                return (
                    movie.title
                        .toLowerCase()
                        .includes(
                            searchText
                        ) ||

                    movie.format
                        .toLowerCase()
                        .includes(
                            searchText
                        )
                );
            }
        );

    movieListElement.innerHTML = "";

    visibleMovies.forEach(
        (movie) => {
            const listItem =
                document.createElement(
                    "li"
                );

            listItem.className =
                "movie-item";

            const movieInformation =
                document.createElement(
                    "div"
                );

            movieInformation.className =
                "movie-information";

            const titleElement =
                document.createElement(
                    "div"
                );

            titleElement.className =
                "movie-title";

            titleElement.textContent =
                movie.title;

            const formatElement =
                document.createElement(
                    "div"
                );

            formatElement.className =
                "movie-format";

            formatElement.textContent =
                movie.format;

            const preferencesElement =
                document.createElement(
                    "div"
                );

            preferencesElement.className =
                "movie-preferences";

            const damienToggle =
                createPreferenceToggle(
                    "Damien",
                    movie.damienWants
                );

            const lisaToggle =
                createPreferenceToggle(
                    "Lisa",
                    movie.lisaWants
                );

            const damienCheckbox =
                damienToggle.querySelector(
                    "input"
                );

            const lisaCheckbox =
                lisaToggle.querySelector(
                    "input"
                );

            damienCheckbox.addEventListener(
                "change",
                () => {
                    updateMoviePreferences(
                        movie.id,
                        damienCheckbox.checked,
                        lisaCheckbox.checked
                    );
                }
            );

            lisaCheckbox.addEventListener(
                "change",
                () => {
                    updateMoviePreferences(
                        movie.id,
                        damienCheckbox.checked,
                        lisaCheckbox.checked
                    );
                }
            );

            preferencesElement.append(
                damienToggle,
                lisaToggle
            );

            const deleteButton =
                document.createElement(
                    "button"
                );

            deleteButton.className =
                "delete-button";

            deleteButton.type =
                "button";

            deleteButton.textContent =
                "Delete";

            deleteButton.addEventListener(
                "click",
                () => {
                    deleteMovie(
                        movie.id
                    );
                }
            );

            movieInformation.append(
                titleElement,
                formatElement,
                preferencesElement
            );

            listItem.append(
                movieInformation,
                deleteButton
            );

            movieListElement.appendChild(
                listItem
            );
        }
    );

    const totalInList =
        filteredMovies.length;

    const movieWord =
        totalInList === 1
            ? "movie"
            : "movies";

    movieCountElement.textContent =
        `${totalInList} ${movieWord}`;

    if (
        searchText &&
        visibleMovies.length === 0
    ) {
        showLibraryMessage(
            "No matching movies found."
        );
    } else if (
        filteredMovies.length === 0
    ) {
        showLibraryMessage(
            "There are no movies in this list."
        );
    } else {
        emptyMessageElement.hidden =
            true;
    }
}

/**
 * Creates one preference checkbox.
 */
function createPreferenceToggle(
    label,
    checked
) {
    const toggle =
        document.createElement(
            "label"
        );

    toggle.className =
        "preference-toggle";

    const checkbox =
        document.createElement(
            "input"
        );

    checkbox.type =
        "checkbox";

    checkbox.checked =
        checked;

    const labelText =
        document.createElement(
            "span"
        );

    labelText.textContent =
        label;

    toggle.append(
        checkbox,
        labelText
    );

    return toggle;
}

/**
 * Displays a library message.
 */
function showLibraryMessage(
    message
) {
    emptyMessageElement.textContent =
        message;

    emptyMessageElement.hidden =
        false;
}

/**
 * Disables controls while the app
 * communicates with Google Sheets.
 */
function setLoadingState(
    isLoading
) {
    pickMovieButton.disabled =
        isLoading;

    movieTitleInput.disabled =
        isLoading;

    movieFormatInput.disabled =
        isLoading;

    damienWantsInput.disabled =
        isLoading;

    lisaWantsInput.disabled =
        isLoading;

    addMovieButton.disabled =
        isLoading;

    preferenceFilter.disabled =
        isLoading;

    pickerPreference.disabled =
        isLoading;
}

/**
 * Add movie form.
 */
movieForm.addEventListener(
    "submit",
    (event) => {
        event.preventDefault();

        addMovie(
            movieTitleInput.value,
            movieFormatInput.value,
            damienWantsInput.checked,
            lisaWantsInput.checked
        );
    }
);

/**
 * Random movie button.
 */
pickMovieButton.addEventListener(
    "click",
    chooseRandomMovie
);

/**
 * Search field.
 */
searchInput.addEventListener(
    "input",
    renderMovies
);

/**
 * List filter.
 */
preferenceFilter.addEventListener(
    "change",
    () => {
        lastSelectedMovieId = null;

        selectedMovieElement.textContent =
            "No movie selected";

        renderMovies();
    }
);

pickerPreference.addEventListener(
    "change",
    () => {
        lastSelectedMovieId = null;

        selectedMovieElement.textContent =
            "No movie selected";
    }
);

/**
 * Start the app.
 */
loadMovies();