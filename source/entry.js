// Entry point for the Block Variation Manager editor bundle.
// Loaded via enqueue_block_editor_assets (see includes/class-assets.php).

import './filters/extend-attributes.js';
import './filters/track-overrides.js';
import './filters/inject-panel.js';
import './admin/variation-editor.js';
import './admin/variation-editor.scss';
import 'driver.js/dist/driver.css';
import './tours/tour.scss';
import { initTourState } from './tours/state.js';

// Seed the onboarding-tour completion cache from the localized map once per
// editor load (see BVM\Assets::enqueue_editor / BVM\Tours).
initTourState( window.BVM?.toursCompleted );
