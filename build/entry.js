/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./source/admin/variation-editor.scss"
/*!********************************************!*\
  !*** ./source/admin/variation-editor.scss ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ },

/***/ "react/jsx-runtime"
/*!**********************************!*\
  !*** external "ReactJSXRuntime" ***!
  \**********************************/
(module) {

module.exports = window["ReactJSXRuntime"];

/***/ },

/***/ "@wordpress/api-fetch"
/*!**********************************!*\
  !*** external ["wp","apiFetch"] ***!
  \**********************************/
(module) {

module.exports = window["wp"]["apiFetch"];

/***/ },

/***/ "@wordpress/block-editor"
/*!*************************************!*\
  !*** external ["wp","blockEditor"] ***!
  \*************************************/
(module) {

module.exports = window["wp"]["blockEditor"];

/***/ },

/***/ "@wordpress/blocks"
/*!********************************!*\
  !*** external ["wp","blocks"] ***!
  \********************************/
(module) {

module.exports = window["wp"]["blocks"];

/***/ },

/***/ "@wordpress/components"
/*!************************************!*\
  !*** external ["wp","components"] ***!
  \************************************/
(module) {

module.exports = window["wp"]["components"];

/***/ },

/***/ "@wordpress/compose"
/*!*********************************!*\
  !*** external ["wp","compose"] ***!
  \*********************************/
(module) {

module.exports = window["wp"]["compose"];

/***/ },

/***/ "@wordpress/data"
/*!******************************!*\
  !*** external ["wp","data"] ***!
  \******************************/
(module) {

module.exports = window["wp"]["data"];

/***/ },

/***/ "@wordpress/dom-ready"
/*!**********************************!*\
  !*** external ["wp","domReady"] ***!
  \**********************************/
(module) {

module.exports = window["wp"]["domReady"];

/***/ },

/***/ "@wordpress/editor"
/*!********************************!*\
  !*** external ["wp","editor"] ***!
  \********************************/
(module) {

module.exports = window["wp"]["editor"];

/***/ },

/***/ "@wordpress/element"
/*!*********************************!*\
  !*** external ["wp","element"] ***!
  \*********************************/
(module) {

module.exports = window["wp"]["element"];

/***/ },

/***/ "@wordpress/hooks"
/*!*******************************!*\
  !*** external ["wp","hooks"] ***!
  \*******************************/
(module) {

module.exports = window["wp"]["hooks"];

/***/ },

/***/ "@wordpress/i18n"
/*!******************************!*\
  !*** external ["wp","i18n"] ***!
  \******************************/
(module) {

module.exports = window["wp"]["i18n"];

/***/ },

/***/ "@wordpress/plugins"
/*!*********************************!*\
  !*** external ["wp","plugins"] ***!
  \*********************************/
(module) {

module.exports = window["wp"]["plugins"];

/***/ },

/***/ "./source/admin/orientation.js"
/*!*************************************!*\
  !*** ./source/admin/orientation.js ***!
  \*************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ORIENTATION_STORAGE_KEY: () => (/* binding */ ORIENTATION_STORAGE_KEY),
/* harmony export */   dispatchOrientationNotice: () => (/* binding */ dispatchOrientationNotice)
/* harmony export */ });
/* harmony import */ var _wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/i18n */ "@wordpress/i18n");
/* harmony import */ var _wordpress_data__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/data */ "@wordpress/data");


const ORIENTATION_STORAGE_KEY = 'bvm-orientation-seen';
const NOTICE_ID = 'bvm-orientation';
function readDismissed() {
  try {
    return window.localStorage.getItem(ORIENTATION_STORAGE_KEY) === '1';
  } catch (_e) {
    return false;
  }
}
function writeDismissed() {
  try {
    window.localStorage.setItem(ORIENTATION_STORAGE_KEY, '1');
  } catch (_e) {
    // ignore — the notice simply reappears next load
  }
}

/**
 * Show the variation-editor orientation banner. Dismissible; dismissal
 * persists in localStorage so agency devs don't re-read the same sentence
 * every time they open a variation.
 */
function dispatchOrientationNotice(usageCount) {
  const notices = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_1__.dispatch)('core/notices');
  if (!notices?.createNotice) return;

  // Remove any previously-shown copy so re-surfacing replaces it.
  notices.removeNotice?.(NOTICE_ID);
  if (readDismissed()) return;
  const usage = usageCount > 0 ? (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.sprintf)(/* translators: %d: number of pages using this variation */
  (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__._n)('Used on %d page.', 'Used on %d pages.', usageCount, 'block-variation-manager'), usageCount) : (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Not used yet.', 'block-variation-manager');
  const explain = (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Saving updates every instance of this variation, except attributes overridden on a specific block.', 'block-variation-manager');
  notices.createNotice('info', `${usage} ${explain}`, {
    id: NOTICE_ID,
    isDismissible: true,
    type: 'default',
    onDismiss: writeDismissed
  });
}

/***/ },

/***/ "./source/admin/strip-post-chrome.js"
/*!*******************************************!*\
  !*** ./source/admin/strip-post-chrome.js ***!
  \*******************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   applyVariationEditorChrome: () => (/* binding */ applyVariationEditorChrome)
/* harmony export */ });
/* harmony import */ var _wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/i18n */ "@wordpress/i18n");
/* harmony import */ var _wordpress_data__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/data */ "@wordpress/data");
/**
 * Trims the standard WP post-editor chrome on the bvm_variation edit screen
 * so it reads as a "variation editor", not a page editor:
 *
 *   - Removes Document panels that don't apply (Status & visibility,
 *     Permalink, Discussion, Template, Excerpt, Featured image, Page
 *     attributes). Variations have no public URL, no discussion, no
 *     template, no scheduling — surfacing those panels is misleading.
 *   - Repoints the top-left "back to dashboard" link at the variations
 *     list (Tools → Block Variations) instead of the generic admin
 *     dashboard, so the implicit "where does this back arrow go" matches
 *     where the user came from.
 *   - Adds a body class so cosmetic CSS can scope further tweaks.
 *
 * The post title placeholder is NOT handled here: core feeds the block
 * editor's titlePlaceholder through PHP's `enter_title_here` filter, which
 * CPT::title_placeholder hooks — no DOM mutation required (the old
 * MutationObserver also could not reach the title once the editor moved it
 * inside the canvas iframe).
 */



const PANELS_TO_REMOVE = ['post-status', 'post-link', 'discussion-panel', 'template', 'page-attributes', 'post-excerpt', 'featured-image'];
function applyVariationEditorChrome() {
  document.body.classList.add('is-bvm-variation-editor');

  // removeEditorPanel moved from core/edit-post to core/editor in WP 6.5.
  // Prefer the new namespace; fall back to the old one for older builds.
  const editor = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_1__.dispatch)('core/editor');
  const editPost = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_1__.dispatch)('core/edit-post');
  const remove = editor?.removeEditorPanel?.bind(editor) ?? editPost?.removeEditorPanel?.bind(editPost);
  if (remove) {
    PANELS_TO_REMOVE.forEach(name => remove(name));
  }
  observeBackLink();
}

/**
 * The top-left "W" / fullscreen-close affordance is rendered by core as an
 * anchor in fullscreen mode; when fullscreen is off (per-user preference) it
 * doesn't exist at all, and some builds render it as a <button>.
 *
 * We retarget the anchor at the variations list. Crucially the observer
 * disconnects as soon as the element is FOUND — whatever its tag (a button
 * will never become an anchor) — and times out entirely if it never appears,
 * instead of running a document-wide querySelector on every DOM mutation for
 * the rest of the session.
 */
function observeBackLink() {
  const url = window.BVM?.variationListUrl;
  if (!url) return;
  const apply = () => {
    const el = document.querySelector('.edit-post-fullscreen-mode-close, .editor-document-tools__back');
    if (!el) return false;
    if ('A' === el.tagName) {
      el.setAttribute('href', url);
      el.setAttribute('aria-label', (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Block Variations', 'block-variation-manager'));
    }
    return true;
  };
  if (apply()) return;
  const observer = new MutationObserver(() => {
    if (apply()) observer.disconnect();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  setTimeout(() => observer.disconnect(), 10000);
}

/***/ },

/***/ "./source/admin/usage-panel.js"
/*!*************************************!*\
  !*** ./source/admin/usage-panel.js ***!
  \*************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/i18n */ "@wordpress/i18n");
/* harmony import */ var _wordpress_plugins__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/plugins */ "@wordpress/plugins");
/* harmony import */ var _wordpress_editor__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @wordpress/editor */ "@wordpress/editor");
/* harmony import */ var _wordpress_data__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @wordpress/data */ "@wordpress/data");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_components__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @wordpress/components */ "@wordpress/components");
/* harmony import */ var _lib_variation_store_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../lib/variation-store.js */ "./source/lib/variation-store.js");
/* harmony import */ var _orientation_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./orientation.js */ "./source/admin/orientation.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");









const VARIATION_CPT = 'bvm_variation';
function UsagePanel() {
  const postId = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_3__.useSelect)(s => s('core/editor')?.getCurrentPostId?.(), []);
  const postType = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_3__.useSelect)(s => s('core/editor')?.getCurrentPostType?.(), []);
  const [instances, setInstances] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_4__.useState)(null);
  const [error, setError] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_4__.useState)(null);
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_4__.useEffect)(() => {
    if (!postId || postType !== VARIATION_CPT) return;
    let cancelled = false;
    (0,_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_6__.listInstances)(postId).then(data => {
      if (!cancelled) setInstances(data);
    }).catch(err => {
      if (!cancelled) setError(err.message || String(err));
    });
    return () => {
      cancelled = true;
    };
  }, [postId, postType]);
  if (postType !== VARIATION_CPT) return null;
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(_wordpress_editor__WEBPACK_IMPORTED_MODULE_2__.PluginDocumentSettingPanel, {
    name: "bvm-usage",
    title: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Usage', 'block-variation-manager'),
    className: "bvm-usage-panel",
    children: [error && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_5__.__experimentalText, {
      as: "p",
      variant: "muted",
      size: "12",
      children: error
    }), instances === null && !error && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_5__.Spinner, {}), Array.isArray(instances) && instances.length === 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_5__.__experimentalText, {
      as: "p",
      variant: "muted",
      size: "12",
      children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Not used on any pages yet.', 'block-variation-manager')
    }), Array.isArray(instances) && instances.length > 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.Fragment, {
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_5__.__experimentalText, {
        as: "p",
        size: "12",
        weight: "600",
        style: {
          marginBottom: 6
        },
        children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.sprintf)(/* translators: %d: number of pages */
        (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__._n)('Used on %d page', 'Used on %d pages', instances.length, 'block-variation-manager'), instances.length)
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("ul", {
        style: {
          margin: 0,
          padding: 0,
          listStyle: 'none'
        },
        children: instances.map(item => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)("li", {
          style: {
            padding: '4px 0',
            borderBottom: '1px solid rgba(0,0,0,0.06)'
          },
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("a", {
            href: item.edit_link || '#',
            target: "_blank",
            rel: "noopener noreferrer",
            children: item.title
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsxs)(_wordpress_components__WEBPACK_IMPORTED_MODULE_5__.__experimentalText, {
            as: "span",
            size: "11",
            variant: "muted",
            style: {
              marginLeft: 6
            },
            children: [item.post_type, 'publish' !== item.status && ` · ${item.status}`]
          })]
        }, item.id))
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)("hr", {
      style: {
        margin: '12px 0'
      }
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_5__.__experimentalText, {
      as: "p",
      size: "11",
      weight: "600",
      upperCase: true,
      children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('About this screen', 'block-variation-manager')
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_5__.__experimentalText, {
      as: "p",
      variant: "muted",
      size: "12",
      style: {
        marginTop: 4
      },
      children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Saving propagates to every instance above, except attributes overridden on a specific block.', 'block-variation-manager')
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_8__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_5__.Button, {
      variant: "link",
      onClick: () => {
        try {
          window.localStorage.removeItem(_orientation_js__WEBPACK_IMPORTED_MODULE_7__.ORIENTATION_STORAGE_KEY);
        } catch (_e) {
          // localStorage unavailable — fine, just re-fire.
        }
        ;(0,_orientation_js__WEBPACK_IMPORTED_MODULE_7__.dispatchOrientationNotice)(window.BVM?.variationUsageCount ?? 0);
      },
      style: {
        paddingLeft: 0
      },
      children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Show orientation banner', 'block-variation-manager')
    })]
  });
}
;(0,_wordpress_plugins__WEBPACK_IMPORTED_MODULE_1__.registerPlugin)('bvm-usage', {
  render: UsagePanel
});

/***/ },

/***/ "./source/admin/variation-editor.js"
/*!******************************************!*\
  !*** ./source/admin/variation-editor.js ***!
  \******************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _wordpress_data__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/data */ "@wordpress/data");
/* harmony import */ var _wordpress_blocks__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/blocks */ "@wordpress/blocks");
/* harmony import */ var _wordpress_dom_ready__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @wordpress/dom-ready */ "@wordpress/dom-ready");
/* harmony import */ var _orientation_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./orientation.js */ "./source/admin/orientation.js");
/* harmony import */ var _strip_post_chrome_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./strip-post-chrome.js */ "./source/admin/strip-post-chrome.js");
/* harmony import */ var _lib_variation_store_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../lib/variation-store.js */ "./source/lib/variation-store.js");
/* harmony import */ var _lib_preset_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../lib/preset.js */ "./source/lib/preset.js");
/* harmony import */ var _usage_panel_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./usage-panel.js */ "./source/admin/usage-panel.js");
/**
 * Runs only on the bvm_variation post edit screen.
 *
 * Enforces "exactly one root block of the variation's block type" while
 * leaving inner blocks fully editable — so the user can build nested
 * structures inside the variation. The root block's attributes are what
 * propagate to every instance; inner blocks ride along as a template
 * that pre-populates each instance on insert (instance-local after that).
 *
 * Enforcement is purely client-side (no root templateLock) because a
 * server-side root templateLock cascades into inner blocks and defeats
 * the point.
 *
 * Also:
 * - Shows a dismissible orientation banner (see ./orientation.js).
 * - Mounts a Document sidebar panel listing every page using this
 *   variation (see ./usage-panel.js).
 */









const ctx = window.BVM ?? {};
if (ctx.isVariationEditor && ctx.variationBlockType) {
  _wordpress_dom_ready__WEBPACK_IMPORTED_MODULE_2__(() => {
    (0,_strip_post_chrome_js__WEBPACK_IMPORTED_MODULE_4__.applyVariationEditorChrome)();
    initVariationEditor(ctx.variationBlockType);
    initAttrsSaveSync(ctx.variationBlockType);
    (0,_orientation_js__WEBPACK_IMPORTED_MODULE_3__.dispatchOrientationNotice)(ctx.variationUsageCount || 0);
  });
}
function findSourceBlock(blocks, name) {
  for (const b of blocks) {
    if (b.name === name) return b;
    const found = findSourceBlock(b.innerBlocks ?? [], name);
    if (found) return found;
  }
  return null;
}

/**
 * After each successful editor save of the variation post, push the source
 * block's fully-resolved attributes (and inner tree) into the variation's
 * meta via PUT /bvm/v1/variations/:id.
 *
 * Why: the server-side save sync can only parse comment-serialized attrs,
 * which lose html-sourced values (heading/button text) and client-registered
 * defaults (Kadence presets). The editor holds the resolved values, so it is
 * the authority — this refresh keeps those keys in the preset (which is what
 * lets instances mark text edits as overrides) and purges stale keys the
 * server-side baseline would otherwise carry forward. The server treats an
 * attrs-only PUT as meta-only (no post_content rewrite), so this cannot loop
 * back into another save.
 */
function initAttrsSaveSync(blockType) {
  let wasSaving = false;
  (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_0__.subscribe)(() => {
    const editor = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_0__.select)('core/editor');
    if (!editor) return;
    const isSaving = (editor.isSavingPost?.() ?? false) && !(editor.isAutosavingPost?.() ?? false);
    const justFinished = wasSaving && !isSaving;
    wasSaving = isSaving;
    if (!justFinished || !editor.didPostSaveRequestSucceed?.()) {
      return;
    }
    const postId = editor.getCurrentPostId?.();
    if (!postId) return;
    const source = findSourceBlock((0,_wordpress_data__WEBPACK_IMPORTED_MODULE_0__.select)('core/block-editor')?.getBlocks?.() ?? [], blockType);
    if (!source) return;
    (0,_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_5__.updateVariation)(postId, {
      attrs: (0,_lib_preset_js__WEBPACK_IMPORTED_MODULE_6__.extractPresetAttrs)(source.attributes ?? {}),
      innerBlocks: (0,_lib_preset_js__WEBPACK_IMPORTED_MODULE_6__.shapeInnerBlocks)(source.innerBlocks ?? [])
    }).catch(() => {
      // Non-fatal: the server-side parse sync already stored a
      // baseline; the next successful save refreshes it.
    });
  });
}
function initVariationEditor(blockType) {
  // Child-only block types (block.json `parent`) are legitimately stored
  // inside synthetic parent wrapper(s) — see Rest::wrap_for_editing. The
  // expected ROOT is therefore the outermost wrapper, not the block type
  // itself. Enforcing against the raw block type here used to destroy
  // child-only variations on open.
  const chain = Array.isArray(ctx.variationRootChain) && ctx.variationRootChain.length ? ctx.variationRootChain : [blockType];
  const expectedRoot = chain[0];
  const seedChain = () => chain.reduceRight((inner, name) => [(0,_wordpress_blocks__WEBPACK_IMPORTED_MODULE_1__.createBlock)(name, {}, inner)], []);
  let reentrant = false;
  (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_0__.subscribe)(() => {
    // IMPORTANT: @wordpress/data fires subscribers synchronously
    // inside dispatch(). resetBlocks() below would re-enter this
    // callback and blow the stack without this guard.
    if (reentrant) return;
    const blockEditor = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_0__.select)('core/block-editor');
    if (!blockEditor) return;

    // During boot getBlocks() is transiently [] before the saved content
    // is parsed into the store; enforcing then would seed a stray block
    // and dirty the post. Wait until the editor reports ready (selector
    // is unstable — fall through when absent on older cores).
    const editorStore = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_0__.select)('core/editor');
    if (editorStore?.__unstableIsEditorReady && !editorStore.__unstableIsEditorReady()) {
      return;
    }
    const blocks = blockEditor.getBlocks();

    // Re-seed an empty editor. Happens on first load of a brand-new
    // variation, and also if the user somehow deletes the root block.
    if (blocks.length === 0) {
      reentrant = true;
      try {
        (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_0__.dispatch)('core/block-editor').resetBlocks(seedChain());
      } finally {
        reentrant = false;
      }
      return;
    }

    // Prune any stray root siblings. Keeps exactly one root of the
    // expected wrapper type. Wrong-type roots are replaced with a fresh
    // seeded chain; extra roots are dropped (inner blocks of the kept
    // root are preserved).
    const first = blocks[0];
    const extraRoots = blocks.length > 1;
    const wrongType = first.name !== expectedRoot;
    if (extraRoots || wrongType) {
      reentrant = true;
      try {
        const kept = wrongType ? seedChain() : [first];
        (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_0__.dispatch)('core/block-editor').resetBlocks(kept);
      } finally {
        reentrant = false;
      }
    }
  });
}

/***/ },

/***/ "./source/components/VariationPanel.js"
/*!*********************************************!*\
  !*** ./source/components/VariationPanel.js ***!
  \*********************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ VariationPanel)
/* harmony export */ });
/* harmony import */ var _wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/i18n */ "@wordpress/i18n");
/* harmony import */ var _wordpress_block_editor__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/block-editor */ "@wordpress/block-editor");
/* harmony import */ var _wordpress_components__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @wordpress/components */ "@wordpress/components");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_blocks__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @wordpress/blocks */ "@wordpress/blocks");
/* harmony import */ var _wordpress_data__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @wordpress/data */ "@wordpress/data");
/* harmony import */ var _lib_variation_store_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../lib/variation-store.js */ "./source/lib/variation-store.js");
/* harmony import */ var _lib_class_pairs_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../lib/class-pairs.js */ "./source/lib/class-pairs.js");
/* harmony import */ var _lib_block_registry_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../lib/block-registry.js */ "./source/lib/block-registry.js");
/* harmony import */ var _constants_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../constants.js */ "./source/constants.js");
/* harmony import */ var _lib_preset_js__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ../lib/preset.js */ "./source/lib/preset.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");












function useVariationsForBlock(blockName) {
  const [list, setList] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useState)(null);
  const [error, setError] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useState)(null);

  // The store's version counter is a snapshot that actually changes on
  // every mutation, so notify() re-renders us AND re-runs the effect —
  // after createVariation invalidates the list cache, the effect refetches
  // and the Apply dropdown picks up the new variation without a remount.
  // (Cache hits resolve instantly, so unrelated ticks are cheap.)
  const tick = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useSyncExternalStore)(_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_6__.subscribe, _lib_variation_store_js__WEBPACK_IMPORTED_MODULE_6__.getVersion);
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    let cancelled = false;
    setError(null);
    (0,_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_6__.listForBlockType)(blockName).then(data => {
      if (!cancelled) setList(data);
    }).catch(err => {
      if (!cancelled) setError(err.message || String(err));
    });
    return () => {
      cancelled = true;
    };
  }, [blockName, tick]);
  return {
    list,
    error
  };
}
function useVariationSnapshot(variationId) {
  ;(0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    ;(0,_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_6__.ensureVariationLoaded)(variationId);
  }, [variationId]);
  return (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useSyncExternalStore)(_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_6__.subscribe, () => variationId ? (0,_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_6__.getCached)(variationId) : null);
}

/**
 * Collapse class-pair overrides into a single entry keyed by the base name.
 * e.g. ['bgColor','bgColorClass','minHeight'] → ['bgColor','minHeight'].
 */
function collapsePairs(overrides) {
  const seen = new Set();
  const out = [];
  for (const key of overrides) {
    const base = (0,_lib_class_pairs_js__WEBPACK_IMPORTED_MODULE_7__.pairBaseKey)(key);
    if (seen.has(base)) continue;
    seen.add(base);
    out.push(base);
  }
  return out;
}
function noticeSuccess(message) {
  const notices = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_5__.dispatch)('core/notices');
  notices?.createNotice?.('success', message, {
    type: 'snackbar',
    isDismissible: true
  });
}

/**
 * Recursively turn [name, attrs, innerBlocks] tuples (the shape we persist
 * in _bvm_variation_inner_blocks) into a tree of block objects ready for
 * replaceInnerBlocks(). createBlock()'s third arg wants block objects, not
 * tuples, so the recursion is necessary.
 */
function tuplesToBlocks(template) {
  if (!Array.isArray(template)) return [];
  return template.map(([name, attrs, inner]) => (0,_wordpress_blocks__WEBPACK_IMPORTED_MODULE_4__.createBlock)(name, attrs && typeof attrs === 'object' ? attrs : {}, tuplesToBlocks(inner)));
}
function SourcePanel({
  attributes,
  setAttributes,
  clientId,
  list,
  listError,
  openInitial
}) {
  const variationId = attributes?.[_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_VARIATION_ID] || 0;
  const overrides = Array.isArray(attributes?.[_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_OVERRIDES]) ? attributes[_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_OVERRIDES] : [];
  const activeVariation = useVariationSnapshot(variationId);
  const [confirmUnlink, setConfirmUnlink] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useState)(false);
  // When user picks a variation that includes inner blocks AND the live
  // block already has children, defer the assignment until they confirm
  // whether to replace or keep existing children.
  // Shape: { id, title, innerBlocks }
  const [pendingApply, setPendingApply] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useState)(null);
  const options = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => {
    const opts = [{
      label: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('— None —', 'block-variation-manager'),
      value: '0'
    }];
    if (list) {
      for (const v of list) {
        opts.push({
          label: v.title,
          value: String(v.id)
        });
      }
    }
    return opts;
  }, [list]);
  const collapsedOverrides = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => collapsePairs(overrides), [overrides]);
  const isOrphaned = variationId > 0 && activeVariation === null;
  const finalizePick = (id, title, replaceChildren, sourceInner) => {
    setAttributes({
      [_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_VARIATION_ID]: id,
      [_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_OVERRIDES]: []
    });
    if (replaceChildren && clientId && Array.isArray(sourceInner)) {
      const blocks = tuplesToBlocks(sourceInner);
      (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_5__.dispatch)('core/block-editor')?.replaceInnerBlocks?.(clientId, blocks, false);
    }
    if (id > 0) {
      noticeSuccess((0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.sprintf)(/* translators: %s: variation title */
      (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Applied variation: %s', 'block-variation-manager'), title ?? (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('variation', 'block-variation-manager')));
    }
  };
  const onPickVariation = async value => {
    const id = parseInt(value, 10);
    if (id <= 0) {
      finalizePick(id, null, false, null);
      return;
    }
    const picked = list?.find(v => v.id === id);
    // We need the full variation record (cached or freshly fetched) to
    // know whether the source has inner blocks worth restoring. The
    // list endpoint already returns inner_blocks per row, but cache may
    // not be warm if the user opened the dropdown immediately.
    const loaded = await (0,_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_6__.ensureVariationLoaded)(id);
    const sourceInner = Array.isArray(loaded?.inner_blocks) ? loaded.inner_blocks : [];
    const existingChildren = clientId ? (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_5__.select)('core/block-editor')?.getBlocks?.(clientId) ?? [] : [];

    // No inner blocks on the source → behave like before; attr-only sync.
    if (sourceInner.length === 0) {
      finalizePick(id, picked?.title, false, null);
      return;
    }
    // Source has inner blocks but the target is empty → restore silently.
    if (existingChildren.length === 0) {
      finalizePick(id, picked?.title, true, sourceInner);
      return;
    }
    // Both sides have children — ask before clobbering the user's work.
    setPendingApply({
      id,
      title: picked?.title,
      innerBlocks: sourceInner
    });
  };
  const onEditSource = () => {
    if (!variationId) return;
    const adminUrl = window.BVM?.adminUrl ?? '/wp-admin/post.php';
    window.open(`${adminUrl}?post=${variationId}&action=edit`, '_blank', 'noopener,noreferrer');
  };
  const onUnlink = () => {
    setAttributes({
      [_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_VARIATION_ID]: 0,
      [_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_OVERRIDES]: []
    });
    setConfirmUnlink(false);
    noticeSuccess((0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Block unlinked from its variation.', 'block-variation-manager'));
  };

  /**
   * Reset a single override chip. The chip is keyed by the base-name
   * (pair-collapsed), so we always remove both halves of a class-pair and
   * restore both sides from the variation.
   */
  const onResetAttr = baseKey => {
    if (!activeVariation) return;
    const pair = (0,_lib_class_pairs_js__WEBPACK_IMPORTED_MODULE_7__.kadenceClassPair)(baseKey);
    const toRemove = new Set([baseKey, pair]);
    const next = overrides.filter(k => !toRemove.has(k));
    const update = {
      [_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_OVERRIDES]: next
    };
    for (const k of toRemove) {
      if (Object.prototype.hasOwnProperty.call(activeVariation.attrs, k)) {
        update[k] = activeVariation.attrs[k];
      }
    }
    setAttributes(update);
  };
  const onResetAll = () => {
    if (!activeVariation) return;
    const update = {
      [_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_OVERRIDES]: []
    };
    for (const key of overrides) {
      if (Object.prototype.hasOwnProperty.call(activeVariation.attrs, key)) {
        update[key] = activeVariation.attrs[key];
      }
    }
    setAttributes(update);
    noticeSuccess((0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Reset all overrides to the variation.', 'block-variation-manager'));
  };
  const overrideCount = collapsedOverrides.length;
  const header = variationId > 0 && overrideCount > 0 ? (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.sprintf)(/* translators: %d: number of overridden attributes */
  (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__._n)('Variation source · %d override', 'Variation source · %d overrides', overrideCount, 'block-variation-manager'), overrideCount) : (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Variation source', 'block-variation-manager');
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.PanelBody, {
    title: header,
    initialOpen: openInitial,
    children: [listError && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Notice, {
      status: "error",
      isDismissible: false,
      children: listError
    }), isOrphaned && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Notice, {
      status: "warning",
      isDismissible: false,
      children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('This block references a variation that no longer exists. Rebind below or unlink.', 'block-variation-manager')
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.SelectControl, {
      label: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Apply', 'block-variation-manager'),
      value: String(variationId),
      options: options,
      onChange: onPickVariation,
      help: list && list.length === 0 ? (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('No variations yet. Style a block and save it as a variation below.', 'block-variation-manager') : undefined,
      __nextHasNoMarginBottom: true
    }), variationId > 0 && activeVariation && overrideCount > 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)("div", {
      style: {
        marginTop: 12
      },
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.__experimentalText, {
        size: "11",
        weight: "600",
        upperCase: true,
        children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Overrides on this instance', 'block-variation-manager')
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.__experimentalText, {
        as: "p",
        variant: "muted",
        size: "12",
        style: {
          marginTop: 4,
          marginBottom: 6
        },
        children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Click a chip to reset that attribute to the variation value.', 'block-variation-manager')
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.__experimentalHStack, {
        wrap: true,
        spacing: 1,
        justify: "flex-start",
        children: [collapsedOverrides.map(key => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Button, {
          variant: "secondary",
          size: "compact",
          onClick: () => onResetAttr(key),
          label: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.sprintf)(/* translators: %s: attribute name */
          (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Reset %s to variation', 'block-variation-manager'), key),
          showTooltip: true,
          children: [key, " \xD7"]
        }, key)), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Button, {
          variant: "tertiary",
          size: "compact",
          onClick: onResetAll,
          children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Reset all overrides', 'block-variation-manager')
        })]
      })]
    }), variationId > 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Flex, {
      gap: 2,
      wrap: true,
      style: {
        marginTop: 12
      },
      justify: "flex-start",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.FlexItem, {
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Button, {
          variant: "secondary",
          onClick: onEditSource,
          disabled: !variationId,
          children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Edit source', 'block-variation-manager')
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.FlexItem, {
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Dropdown, {
          popoverProps: {
            placement: 'bottom-end'
          },
          renderToggle: ({
            onToggle,
            isOpen
          }) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Button, {
            variant: "tertiary",
            onClick: onToggle,
            "aria-expanded": isOpen,
            disabled: confirmUnlink,
            children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('More', 'block-variation-manager')
          }),
          renderContent: ({
            onClose
          }) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.MenuGroup, {
            children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.MenuItem, {
              isDestructive: true,
              onClick: () => {
                onClose();
                setConfirmUnlink(true);
              },
              children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Unlink from variation', 'block-variation-manager')
            })
          })
        })
      })]
    }), confirmUnlink && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.__experimentalConfirmDialog, {
      onConfirm: onUnlink,
      onCancel: () => setConfirmUnlink(false),
      confirmButtonText: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Unlink', 'block-variation-manager'),
      children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Unlink this block from its variation? It will keep its current values but stop receiving future updates.', 'block-variation-manager')
    }), pendingApply && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.__experimentalConfirmDialog, {
      onConfirm: () => {
        const p = pendingApply;
        setPendingApply(null);
        finalizePick(p.id, p.title, true, p.innerBlocks);
      },
      onCancel: () => {
        const p = pendingApply;
        setPendingApply(null);
        // User opted to keep existing children — apply
        // attrs only, don't touch innerBlocks.
        finalizePick(p.id, p.title, false, null);
      },
      confirmButtonText: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Replace children', 'block-variation-manager'),
      cancelButtonText: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Keep existing children', 'block-variation-manager'),
      children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('This variation includes child blocks. Replace this block\u2019s existing children with the variation\u2019s, or keep the current ones?', 'block-variation-manager')
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.__experimentalText, {
      as: "p",
      variant: "muted",
      size: "12",
      style: {
        marginTop: 12
      },
      children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Changes to the source variation propagate here automatically, except for attributes you override on this instance.', 'block-variation-manager')
    })]
  });
}
function SavePanel({
  attributes,
  setAttributes,
  name,
  clientId,
  list
}) {
  const [newName, setNewName] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useState)('');
  const [isSaving, setIsSaving] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useState)(false);
  const [saveError, setSaveError] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useState)(null);
  const [pendingConfirm, setPendingConfirm] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useState)(null);
  const trimmed = newName.trim();
  const duplicate = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useMemo)(() => list ? list.some(v => v.title.toLowerCase() === trimmed.toLowerCase()) : false, [list, trimmed]);
  const performSave = async shouldCommitPost => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const preset = (0,_lib_preset_js__WEBPACK_IMPORTED_MODULE_10__.extractPresetAttrs)(attributes);

      // The registry cache loads lazily; a save racing the fetch (or
      // following a failed fetch) would silently skip child capture
      // and create a parent-block variation with no children. Await
      // resolution — instant once cached, retried after failures.
      await (0,_lib_block_registry_js__WEBPACK_IMPORTED_MODULE_8__.ensureRegistryLoaded)();

      // Capture the full live inner-block tree if the registry says
      // this block has required children (e.g. kadence/advancedbtn
      // with kadence/singlebtn children). Reading via getBlocks
      // gives us resolved attrs from the editor, not the lossy
      // serialized comment representation.
      let liveChildren;
      let innerBlocks;
      if (clientId && (0,_lib_block_registry_js__WEBPACK_IMPORTED_MODULE_8__.hasRequiredChildren)(name)) {
        const children = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_5__.select)('core/block-editor')?.getBlocks?.(clientId);
        if (Array.isArray(children) && children.length > 0) {
          liveChildren = children;
          innerBlocks = (0,_lib_preset_js__WEBPACK_IMPORTED_MODULE_10__.shapeInnerBlocks)(children);
        }
      }
      const block = (0,_wordpress_blocks__WEBPACK_IMPORTED_MODULE_4__.createBlock)(name, preset, Array.isArray(liveChildren) ? liveChildren : []);
      const content = (0,_wordpress_blocks__WEBPACK_IMPORTED_MODULE_4__.serialize)(block);
      const created = await (0,_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_6__.createVariation)({
        title: trimmed,
        blockType: name,
        attrs: preset,
        content,
        innerBlocks
      });
      setAttributes({
        [_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_VARIATION_ID]: created.id,
        [_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_OVERRIDES]: []
      });
      setNewName('');
      noticeSuccess((0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.sprintf)(/* translators: %s: variation title */
      (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Variation "%s" created.', 'block-variation-manager'), created.title));
      if (shouldCommitPost) {
        const editorStore = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_5__.dispatch)('core/editor');
        if (editorStore?.savePost) {
          try {
            await editorStore.savePost();
          } catch (_err) {
            // Non-fatal — variation was created.
          }
        }
      }
    } catch (err) {
      setSaveError(err.message || String(err));
    } finally {
      setIsSaving(false);
      setPendingConfirm(null);
    }
  };
  const onSave = () => {
    // If the post has dirty state other than our pending linkage, the
    // post-save that counts this variation as its first instance would
    // also commit everything else. Confirm before doing that.
    const editor = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_5__.select)('core/editor');
    const isDirty = editor?.isEditedPostDirty?.() ?? false;
    if (isDirty) {
      setPendingConfirm('dirty');
      return;
    }
    // Post is clean — we need to save after linking so the usage count
    // picks it up. No user surprise because there are no other changes.
    performSave(true);
  };
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.PanelBody, {
    title: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Save as variation', 'block-variation-manager'),
    initialOpen: false,
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.TextControl, {
      label: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Name', 'block-variation-manager'),
      value: newName,
      onChange: setNewName,
      placeholder: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('e.g. Brand hero', 'block-variation-manager'),
      __nextHasNoMarginBottom: true
    }), trimmed && duplicate && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Notice, {
      status: "warning",
      isDismissible: false,
      children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('A variation with this name already exists. Saving will create a second one.', 'block-variation-manager')
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Button, {
      variant: "primary",
      onClick: onSave,
      disabled: isSaving || !trimmed,
      style: {
        marginTop: 8
      },
      children: isSaving ? (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Saving…', 'block-variation-manager') : (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Save variation', 'block-variation-manager')
    }), saveError && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.Notice, {
      status: "error",
      isDismissible: false,
      children: saveError
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.__experimentalText, {
      as: "p",
      variant: "muted",
      size: "12",
      style: {
        marginTop: 12
      },
      children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)("The current block's attributes become the new variation's defaults. You can edit it later from Tools → Block Variations.", 'block-variation-manager')
    }), pendingConfirm === 'dirty' && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_2__.__experimentalConfirmDialog, {
      onConfirm: () => performSave(true),
      onCancel: () => {
        // Create the variation but don't auto-save the post.
        // The block's link will persist on next manual save.
        setPendingConfirm(null);
        performSave(false);
      },
      confirmButtonText: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Save page and variation', 'block-variation-manager'),
      cancelButtonText: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('Create variation only', 'block-variation-manager'),
      children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_0__.__)('This page has unsaved changes. Saving the variation now will also commit those changes to the page. Proceed, or create the variation without saving the page?', 'block-variation-manager')
    })]
  });
}
function VariationPanel({
  attributes,
  setAttributes,
  name,
  clientId
}) {
  const variationId = attributes?.[_constants_js__WEBPACK_IMPORTED_MODULE_9__.BVM_ATTR_VARIATION_ID] || 0;
  const {
    list,
    error
  } = useVariationsForBlock(name);

  // Lazy-load the block-policy registry once; cheap no-op after first call.
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_3__.useEffect)(() => {
    (0,_lib_block_registry_js__WEBPACK_IMPORTED_MODULE_8__.ensureRegistryLoaded)();
  }, []);
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsxs)(_wordpress_block_editor__WEBPACK_IMPORTED_MODULE_1__.InspectorControls, {
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(SourcePanel, {
      attributes: attributes,
      setAttributes: setAttributes,
      clientId: clientId,
      list: list,
      listError: error,
      openInitial: variationId > 0
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_11__.jsx)(SavePanel, {
      attributes: attributes,
      setAttributes: setAttributes,
      name: name,
      clientId: clientId,
      list: list
    })]
  });
}

/***/ },

/***/ "./source/constants.js"
/*!*****************************!*\
  !*** ./source/constants.js ***!
  \*****************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BVM_ATTR_OVERRIDES: () => (/* binding */ BVM_ATTR_OVERRIDES),
/* harmony export */   BVM_ATTR_VARIATION_ID: () => (/* binding */ BVM_ATTR_VARIATION_ID),
/* harmony export */   INTERNAL_ATTRS: () => (/* binding */ INTERNAL_ATTRS),
/* harmony export */   PRESET_EXCLUDED_ATTRS: () => (/* binding */ PRESET_EXCLUDED_ATTRS)
/* harmony export */ });
const BVM_ATTR_VARIATION_ID = 'bvmVariationId';
const BVM_ATTR_OVERRIDES = 'bvmOverriddenAttrs';

// Attributes we should never treat as user-set overrides — they're bookkeeping.
const INTERNAL_ATTRS = new Set([BVM_ATTR_VARIATION_ID, BVM_ATTR_OVERRIDES, 'className', 'anchor', 'lock', 'metadata']);

// Attributes that must never enter a variation preset: the bookkeeping set
// above plus per-instance identity attrs (Kadence's uniqueID drives its
// request-time CSS selectors — sharing one across instances breaks styling).
// Mirrors Attributes::excluded_attrs() on the PHP side.
const PRESET_EXCLUDED_ATTRS = new Set([...INTERNAL_ATTRS, 'uniqueID', 'uniqueId']);

/***/ },

/***/ "./source/filters/extend-attributes.js"
/*!*********************************************!*\
  !*** ./source/filters/extend-attributes.js ***!
  \*********************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _wordpress_hooks__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/hooks */ "@wordpress/hooks");
/* harmony import */ var _constants_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../constants.js */ "./source/constants.js");



/**
 * Mirror of the PHP register_block_type_args extension: add bvmVariationId
 * and bvmOverriddenAttrs to every block's attribute schema on the client,
 * so the editor knows how to serialize/deserialize them.
 */
function extendBlockAttributes(settings) {
  if (!settings.attributes) {
    settings.attributes = {};
  }
  if (!settings.attributes[_constants_js__WEBPACK_IMPORTED_MODULE_1__.BVM_ATTR_VARIATION_ID]) {
    settings.attributes[_constants_js__WEBPACK_IMPORTED_MODULE_1__.BVM_ATTR_VARIATION_ID] = {
      type: 'number',
      default: 0
    };
  }
  if (!settings.attributes[_constants_js__WEBPACK_IMPORTED_MODULE_1__.BVM_ATTR_OVERRIDES]) {
    settings.attributes[_constants_js__WEBPACK_IMPORTED_MODULE_1__.BVM_ATTR_OVERRIDES] = {
      type: 'array',
      default: [],
      items: {
        type: 'string'
      }
    };
  }
  return settings;
}
;(0,_wordpress_hooks__WEBPACK_IMPORTED_MODULE_0__.addFilter)('blocks.registerBlockType', 'bvm/extend-attributes', extendBlockAttributes);

/***/ },

/***/ "./source/filters/inject-panel.js"
/*!****************************************!*\
  !*** ./source/filters/inject-panel.js ***!
  \****************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _wordpress_hooks__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/hooks */ "@wordpress/hooks");
/* harmony import */ var _wordpress_compose__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/compose */ "@wordpress/compose");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _components_VariationPanel_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../components/VariationPanel.js */ "./source/components/VariationPanel.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");





/**
 * Skip adding the panel to blocks we can't meaningfully vary.
 */

const BLOCKLIST = new Set(['core/freeform', 'core/missing', 'core/block' // synced pattern wrapper
]);
const withVariationPanel = (0,_wordpress_compose__WEBPACK_IMPORTED_MODULE_1__.createHigherOrderComponent)(BlockEdit => {
  return props => {
    // Don't offer the "save/apply variation" UI inside the variation
    // editor itself — that's where the variation's source block lives.
    const isVariationEditor = !!window.BVM?.isVariationEditor;
    if (isVariationEditor || BLOCKLIST.has(props.name) || !props.isSelected) {
      return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(BlockEdit, {
        ...props
      });
    }
    return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(BlockEdit, {
        ...props
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx)(_components_VariationPanel_js__WEBPACK_IMPORTED_MODULE_3__["default"], {
        attributes: props.attributes,
        setAttributes: props.setAttributes,
        name: props.name,
        clientId: props.clientId
      })]
    });
  };
}, 'withVariationPanel');
(0,_wordpress_hooks__WEBPACK_IMPORTED_MODULE_0__.addFilter)('editor.BlockEdit', 'bvm/inject-panel', withVariationPanel);

/***/ },

/***/ "./source/filters/track-overrides.js"
/*!*******************************************!*\
  !*** ./source/filters/track-overrides.js ***!
  \*******************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _wordpress_hooks__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/hooks */ "@wordpress/hooks");
/* harmony import */ var _wordpress_compose__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/compose */ "@wordpress/compose");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _constants_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../constants.js */ "./source/constants.js");
/* harmony import */ var _lib_equality_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../lib/equality.js */ "./source/lib/equality.js");
/* harmony import */ var _lib_class_pairs_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../lib/class-pairs.js */ "./source/lib/class-pairs.js");
/* harmony import */ var _lib_variation_store_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../lib/variation-store.js */ "./source/lib/variation-store.js");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");








/**
 * Wraps every block's Edit component to:
 *
 * 1. Sync variation → store on mount and when the variation's attrs change.
 *    For each non-overridden variation attr that differs from what's stored,
 *    write the current variation value into the block-editor store. This
 *    makes edits to the source variation propagate into open posts.
 *
 * 2. Track overrides on user edits — wrap setAttributes so that setting an
 *    attr to a value different from the variation marks it overridden;
 *    setting it back to the variation value unmarks it.
 *
 * Why sync-to-store instead of merge-as-prop:
 *   Prop-merging (passing a synthesized `attributes` prop to BlockEdit without
 *   touching the store) makes the displayed values lie to third-party controls
 *   like Kadence's color picker. The picker fires setAttributes in multiple
 *   batched calls (e.g. bgColorClass first, bgColor second). If the merge
 *   shows variation values for attrs the user hasn't touched yet, the block
 *   renders with user-bgColorClass + variation-bgColor until the second batch
 *   lands — looking as if the first click did nothing. Writing real values
 *   into the store keeps all Kadence internal state consistent from the start.
 *
 *   The tradeoff: syncing dirties the post. That's acceptable — if the
 *   variation has genuinely changed since the post was last saved, the user
 *   should save to persist the updated values.
 */

function useVariation(variationId) {
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
    if (variationId) {
      (0,_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_6__.ensureVariationLoaded)(variationId);
    }
  }, [variationId]);
  return (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useSyncExternalStore)(_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_6__.subscribe, () => variationId ? (0,_lib_variation_store_js__WEBPACK_IMPORTED_MODULE_6__.getCached)(variationId) : null);
}
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Stable identity for "no attrs" — a fresh {} per render would churn the
 * wrappedSetAttributes useCallback (and thus the setAttributes prop) for
 * every unlinked block on every render. */
const EMPTY_ATTRS = {};
const withVariationOverrides = (0,_wordpress_compose__WEBPACK_IMPORTED_MODULE_1__.createHigherOrderComponent)(BlockEdit => {
  return props => {
    const {
      attributes,
      setAttributes
    } = props;
    const variationId = attributes?.[_constants_js__WEBPACK_IMPORTED_MODULE_3__.BVM_ATTR_VARIATION_ID] || 0;
    // undefined = record still loading; null = confirmed missing.
    const variation = useVariation(variationId);
    const variationAttrs = variation?.attrs ?? EMPTY_ATTRS;
    const overriddenList = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => Array.isArray(attributes?.[_constants_js__WEBPACK_IMPORTED_MODULE_3__.BVM_ATTR_OVERRIDES]) ? attributes[_constants_js__WEBPACK_IMPORTED_MODULE_3__.BVM_ATTR_OVERRIDES] : [], [attributes]);

    // Keep the latest references reachable from the sync effect without
    // making it re-run on every attribute change. overriddenRef is ALSO
    // updated synchronously inside wrappedSetAttributes: two calls in the
    // same tick share one render's closure, and basing the second call on
    // the stale render-scope list would erase the first call's marks.
    const attributesRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useRef)(attributes);
    attributesRef.current = attributes;
    const overriddenRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useRef)(overriddenList);
    overriddenRef.current = overriddenList;
    const setAttributesRef = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useRef)(setAttributes);
    setAttributesRef.current = setAttributes;

    // Fingerprint of the variation's attrs — re-sync only when these change,
    // not on every keystroke in the post.
    const variationAttrsKey = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useMemo)(() => variation ? JSON.stringify(variationAttrs) : '', [variation, variationAttrs]);
    (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useEffect)(() => {
      if (!variationId || !variation) return;
      const current = attributesRef.current ?? {};
      const overriddenSet = new Set(overriddenRef.current);
      const update = {};
      for (const [key, value] of Object.entries(variationAttrs)) {
        if (_constants_js__WEBPACK_IMPORTED_MODULE_3__.INTERNAL_ATTRS.has(key)) continue;
        if (overriddenSet.has(key)) continue;
        if (!(0,_lib_equality_js__WEBPACK_IMPORTED_MODULE_4__.deepEqual)(current[key], value)) {
          update[key] = value;
        }
      }
      // Reconcile marks recorded conservatively while the record was
      // loading (see wrappedSetAttributes): drop entries whose live
      // value matches the variation after all, or that the variation
      // doesn't define — stale marks would wrongly block server-side
      // propagation for this instance.
      const reconciled = Array.from(overriddenSet).filter(key => {
        if (!Object.prototype.hasOwnProperty.call(variationAttrs, key)) {
          return false;
        }
        return !(0,_lib_equality_js__WEBPACK_IMPORTED_MODULE_4__.deepEqual)(current[key], variationAttrs[key]);
      }).sort();
      if (!arraysEqual(reconciled, [...overriddenSet].sort())) {
        update[_constants_js__WEBPACK_IMPORTED_MODULE_3__.BVM_ATTR_OVERRIDES] = reconciled;
        overriddenRef.current = reconciled;
      }
      if (Object.keys(update).length > 0) {
        setAttributesRef.current(update);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [variationId, variationAttrsKey]);
    const wrappedSetAttributes = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_2__.useCallback)(next => {
      // null = confirmed missing — nothing to track against.
      if (!variationId || variation === null) {
        setAttributes(next);
        return;
      }
      const changed = {
        ...next
      };
      const overrides = new Set(overriddenRef.current);
      const loading = variation === undefined;
      for (const key of Object.keys(next)) {
        if (_constants_js__WEBPACK_IMPORTED_MODULE_3__.INTERNAL_ATTRS.has(key)) continue;
        if (loading) {
          // The record hasn't arrived yet, so we can't compare
          // values. Mark conservatively — otherwise the sync
          // effect would revert this edit the moment the fetch
          // resolves. The effect's reconcile pass drops marks
          // that turn out to match the variation.
          overrides.add(key);
          continue;
        }
        const hasVariationValue = Object.prototype.hasOwnProperty.call(variationAttrs, key);
        if (!hasVariationValue) {
          continue;
        }
        if ((0,_lib_equality_js__WEBPACK_IMPORTED_MODULE_4__.deepEqual)(next[key], variationAttrs[key])) {
          overrides.delete(key);
          // Un-mark the class-pair sibling too when its live
          // value also matches — marking added them together,
          // so a one-half reset must not strand the other half
          // as a permanent phantom override.
          const pair = (0,_lib_class_pairs_js__WEBPACK_IMPORTED_MODULE_5__.kadenceClassPair)(key);
          if (overrides.has(pair) && Object.prototype.hasOwnProperty.call(variationAttrs, pair)) {
            const pairValue = Object.prototype.hasOwnProperty.call(next, pair) ? next[pair] : attributesRef.current?.[pair];
            if ((0,_lib_equality_js__WEBPACK_IMPORTED_MODULE_4__.deepEqual)(pairValue, variationAttrs[pair])) {
              overrides.delete(pair);
            }
          }
        } else {
          overrides.add(key);
          // Kadence fires bgColor + bgColorClass in separate
          // setAttributes calls. Mark the pair together so the
          // user sees a single consistent override state after
          // the first click instead of half a chip set.
          const pair = (0,_lib_class_pairs_js__WEBPACK_IMPORTED_MODULE_5__.kadenceClassPair)(key);
          if (Object.prototype.hasOwnProperty.call(variationAttrs, pair)) {
            overrides.add(pair);
          }
        }
      }
      const newOverrides = Array.from(overrides).sort();
      if (!arraysEqual(newOverrides, overriddenRef.current)) {
        changed[_constants_js__WEBPACK_IMPORTED_MODULE_3__.BVM_ATTR_OVERRIDES] = newOverrides;
        overriddenRef.current = newOverrides;
      }
      setAttributes(changed);
    }, [variationId, variation, variationAttrs, setAttributes]);
    return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(BlockEdit, {
      ...props,
      setAttributes: wrappedSetAttributes
    });
  };
}, 'withVariationOverrides');
(0,_wordpress_hooks__WEBPACK_IMPORTED_MODULE_0__.addFilter)('editor.BlockEdit', 'bvm/track-overrides', withVariationOverrides);

/***/ },

/***/ "./source/lib/block-registry.js"
/*!**************************************!*\
  !*** ./source/lib/block-registry.js ***!
  \**************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ensureRegistryLoaded: () => (/* binding */ ensureRegistryLoaded),
/* harmony export */   hasRequiredChildren: () => (/* binding */ hasRequiredChildren)
/* harmony export */ });
/* harmony import */ var _wordpress_api_fetch__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/api-fetch */ "@wordpress/api-fetch");
/* harmony import */ var _rest_path_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./rest-path.js */ "./source/lib/rest-path.js");



/**
 * REST-backed mirror of the PHP BlockRegistry.
 *
 * Loaded lazily on first access. Used by SavePanel (decide whether to capture
 * inner blocks) and SourcePanel (decide whether to prompt before replacing
 * existing children on apply). Callers on save paths should `await
 * ensureRegistryLoaded()` before consulting the sync accessors — the cache
 * starts empty and a pre-load read returns the EMPTY policy.
 */

let cache = null;
let inflight = null;
const EMPTY = {
  required_children: []
};
function ensureRegistryLoaded() {
  if (cache || inflight) return inflight ?? Promise.resolve(cache);
  inflight = _wordpress_api_fetch__WEBPACK_IMPORTED_MODULE_0__({
    path: (0,_rest_path_js__WEBPACK_IMPORTED_MODULE_1__.restPath)('/registry')
  }).then(data => {
    cache = data && typeof data === 'object' ? data : {};
    inflight = null;
    return cache;
  }).catch(() => {
    // Leave the cache unset so the next call retries — one failed
    // fetch (security-plugin 403, transient 500) must not silently
    // disable required-children capture for the whole session.
    inflight = null;
    return null;
  });
  return inflight;
}
function entry(blockName) {
  if (!cache) return EMPTY;
  return cache[blockName] ?? EMPTY;
}
function hasRequiredChildren(blockName) {
  const e = entry(blockName);
  return Array.isArray(e.required_children) && e.required_children.length > 0;
}

/***/ },

/***/ "./source/lib/class-pairs.js"
/*!***********************************!*\
  !*** ./source/lib/class-pairs.js ***!
  \***********************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   kadenceClassPair: () => (/* binding */ kadenceClassPair),
/* harmony export */   pairBaseKey: () => (/* binding */ pairBaseKey)
/* harmony export */ });
/**
 * Kadence (and some other WP block libs) store color-like attributes as a
 * pair: `fooColor` holds the palette slug/hex, `fooColorClass` holds the CSS
 * class, and pickers fire the two halves in separate setAttributes calls.
 * Tracking and resetting them as a pair keeps override state consistent from
 * the first call. Shared by the override tracker and the sidebar panel so the
 * two can never disagree about what constitutes a pair.
 */
function kadenceClassPair(key) {
  if (key.endsWith('Class') && key.length > 5) {
    return key.slice(0, -5);
  }
  return key + 'Class';
}

/** Base key for a class-pair — strips the `Class` suffix when present. */
function pairBaseKey(key) {
  return key.endsWith('Class') && key.length > 5 ? key.slice(0, -5) : key;
}

/***/ },

/***/ "./source/lib/equality.js"
/*!********************************!*\
  !*** ./source/lib/equality.js ***!
  \********************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   deepEqual: () => (/* binding */ deepEqual)
/* harmony export */ });
/**
 * Shallow-ish equality check good enough for comparing block attribute values.
 * Handles primitives, arrays, and plain objects up to reasonable depth.
 */
function deepEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a !== 'object') {
    return false;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) {
    return false;
  }
  for (const key of keysA) {
    if (!deepEqual(a[key], b[key])) {
      return false;
    }
  }
  return true;
}

/***/ },

/***/ "./source/lib/preset.js"
/*!******************************!*\
  !*** ./source/lib/preset.js ***!
  \******************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   extractPresetAttrs: () => (/* binding */ extractPresetAttrs),
/* harmony export */   shapeInnerBlocks: () => (/* binding */ shapeInnerBlocks)
/* harmony export */ });
/* harmony import */ var _constants_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../constants.js */ "./source/constants.js");


/**
 * The attrs worth persisting as a variation preset: everything the editor has
 * resolved for the block minus bookkeeping and per-instance identity attrs.
 * Shared by the sidebar Save panel and the variation editor's post-save sync
 * so both write identical shapes.
 */
function extractPresetAttrs(attributes) {
  const out = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (_constants_js__WEBPACK_IMPORTED_MODULE_0__.PRESET_EXCLUDED_ATTRS.has(key)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Recursively shape a tree of editor block objects into the
 * { name, attributes, innerBlocks } payload the REST endpoint stores.
 * Strips excluded attrs and undefined values at every depth.
 */
function shapeInnerBlocks(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks.filter(b => b && typeof b.name === 'string' && b.name !== '').map(b => ({
    name: b.name,
    attributes: extractPresetAttrs(b.attributes ?? {}),
    innerBlocks: shapeInnerBlocks(b.innerBlocks)
  }));
}

/***/ },

/***/ "./source/lib/rest-path.js"
/*!*********************************!*\
  !*** ./source/lib/rest-path.js ***!
  \*********************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   restPath: () => (/* binding */ restPath)
/* harmony export */ });
/** Build a plugin REST path. Single home for the namespace fallback. */
const restPath = suffix => `/${window.BVM?.restNamespace ?? 'bvm/v1'}${suffix}`;

/***/ },

/***/ "./source/lib/variation-store.js"
/*!***************************************!*\
  !*** ./source/lib/variation-store.js ***!
  \***************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createVariation: () => (/* binding */ createVariation),
/* harmony export */   ensureVariationLoaded: () => (/* binding */ ensureVariationLoaded),
/* harmony export */   fetchVariation: () => (/* binding */ fetchVariation),
/* harmony export */   getCached: () => (/* binding */ getCached),
/* harmony export */   getVersion: () => (/* binding */ getVersion),
/* harmony export */   invalidateList: () => (/* binding */ invalidateList),
/* harmony export */   listForBlockType: () => (/* binding */ listForBlockType),
/* harmony export */   listInstances: () => (/* binding */ listInstances),
/* harmony export */   subscribe: () => (/* binding */ subscribe),
/* harmony export */   updateVariation: () => (/* binding */ updateVariation)
/* harmony export */ });
/* harmony import */ var _wordpress_api_fetch__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/api-fetch */ "@wordpress/api-fetch");
/* harmony import */ var _rest_path_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./rest-path.js */ "./source/lib/rest-path.js");


const listeners = new Set();
const cache = new Map(); // id -> variation object, or null = confirmed missing
const listCache = new Map(); // block_type -> array
const inflight = new Map(); // id -> Promise
const inflightLists = new Map(); // block_type -> Promise

/**
 * Monotonic change counter. useSyncExternalStore consumers snapshot this —
 * it actually changes on every mutation, unlike a constant sentinel key
 * (which never triggers a re-render no matter how often notify() fires).
 */
let version = 0;
function notify() {
  version++;
  for (const fn of listeners) {
    fn();
  }
}
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getVersion() {
  return version;
}

/**
 * Three states, and callers rely on the distinction:
 *   undefined — never fetched (loading/unknown)
 *   null      — confirmed missing (deleted/unpublished variation)
 *   object    — loaded record
 */
function getCached(id) {
  return cache.has(id) ? cache.get(id) : undefined;
}
function fetchVariation(id) {
  if (!id) {
    return Promise.resolve(null);
  }
  if (inflight.has(id)) {
    return inflight.get(id);
  }
  const promise = _wordpress_api_fetch__WEBPACK_IMPORTED_MODULE_0__({
    path: (0,_rest_path_js__WEBPACK_IMPORTED_MODULE_1__.restPath)(`/variations/${id}`)
  }).then(data => {
    inflight.delete(id);
    cache.set(id, data);
    notify();
    return data;
  }).catch(err => {
    inflight.delete(id);
    // Only a definitive "gone" is negative-cached. Transient failures
    // (network, 5xx, expired nonce) stay uncached so the next mount
    // retries — permanently caching them disabled override tracking
    // for the whole session while the server kept merging the
    // variation into every render.
    if (404 === err?.data?.status || 'bvm_not_found' === err?.code) {
      cache.set(id, null);
      notify();
      return null;
    }
    throw err;
  });
  inflight.set(id, promise);
  return promise;
}
function ensureVariationLoaded(id) {
  if (!id) {
    return Promise.resolve(null);
  }
  if (cache.has(id)) {
    return Promise.resolve(cache.get(id));
  }
  return fetchVariation(id).catch(() => null);
}
async function listForBlockType(blockType) {
  if (listCache.has(blockType)) {
    return listCache.get(blockType);
  }
  if (inflightLists.has(blockType)) {
    return inflightLists.get(blockType);
  }
  const promise = _wordpress_api_fetch__WEBPACK_IMPORTED_MODULE_0__({
    path: (0,_rest_path_js__WEBPACK_IMPORTED_MODULE_1__.restPath)(`/variations?block_type=${encodeURIComponent(blockType)}`)
  }).then(data => {
    listCache.set(blockType, data);
    for (const variation of data) {
      cache.set(variation.id, variation);
    }
    inflightLists.delete(blockType);
    notify();
    return data;
  }).catch(err => {
    inflightLists.delete(blockType);
    throw err;
  });
  inflightLists.set(blockType, promise);
  return promise;
}
async function listInstances(variationId) {
  if (!variationId) return [];
  const data = await _wordpress_api_fetch__WEBPACK_IMPORTED_MODULE_0__({
    path: (0,_rest_path_js__WEBPACK_IMPORTED_MODULE_1__.restPath)(`/variations/${variationId}/instances`)
  });
  return Array.isArray(data?.instances) ? data.instances : [];
}
function invalidateList(blockType) {
  if (blockType) {
    listCache.delete(blockType);
  } else {
    listCache.clear();
  }
  notify();
}
async function createVariation({
  title,
  blockType,
  attrs,
  content,
  innerBlocks
}) {
  const body = {
    title,
    block_type: blockType,
    attrs,
    content
  };
  if (Array.isArray(innerBlocks)) {
    body.inner_blocks = innerBlocks;
  }
  const data = await _wordpress_api_fetch__WEBPACK_IMPORTED_MODULE_0__({
    path: (0,_rest_path_js__WEBPACK_IMPORTED_MODULE_1__.restPath)('/variations'),
    method: 'POST',
    data: body
  });
  cache.set(data.id, data);
  invalidateList(blockType);
  return data;
}
async function updateVariation(id, payload) {
  const body = {};
  if ('title' in payload) body.title = payload.title;
  if ('attrs' in payload) body.attrs = payload.attrs;
  if ('innerBlocks' in payload) body.inner_blocks = payload.innerBlocks;
  const data = await _wordpress_api_fetch__WEBPACK_IMPORTED_MODULE_0__({
    path: (0,_rest_path_js__WEBPACK_IMPORTED_MODULE_1__.restPath)(`/variations/${id}`),
    method: 'PUT',
    data: body
  });
  cache.set(data.id, data);
  invalidateList(data.block_type);
  return data;
}

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			const e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter/value functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			if(Array.isArray(definition)) {
/******/ 				var i = 0;
/******/ 				while(i < definition.length) {
/******/ 					var key = definition[i++];
/******/ 					var binding = definition[i++];
/******/ 					if(!__webpack_require__.o(exports, key)) {
/******/ 						if(binding === 0) {
/******/ 							Object.defineProperty(exports, key, { enumerable: true, value: definition[i++] });
/******/ 						} else {
/******/ 							Object.defineProperty(exports, key, { enumerable: true, get: binding });
/******/ 						}
/******/ 					} else if(binding === 0) { i++; }
/******/ 				}
/******/ 			} else {
/******/ 				for(var key in definition) {
/******/ 					if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 						Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 					}
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.hasOwn(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
let __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!*************************!*\
  !*** ./source/entry.js ***!
  \*************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _filters_extend_attributes_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./filters/extend-attributes.js */ "./source/filters/extend-attributes.js");
/* harmony import */ var _filters_track_overrides_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./filters/track-overrides.js */ "./source/filters/track-overrides.js");
/* harmony import */ var _filters_inject_panel_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./filters/inject-panel.js */ "./source/filters/inject-panel.js");
/* harmony import */ var _admin_variation_editor_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./admin/variation-editor.js */ "./source/admin/variation-editor.js");
/* harmony import */ var _admin_variation_editor_scss__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./admin/variation-editor.scss */ "./source/admin/variation-editor.scss");
// Entry point for the Block Variation Manager editor bundle.
// Loaded via enqueue_block_editor_assets (see includes/class-assets.php).






})();

/******/ })()
;
//# sourceMappingURL=entry.js.map