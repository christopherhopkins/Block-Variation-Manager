<?php
namespace BVM;

if ( ! defined( 'ABSPATH' ) ) {
	die();
}

class Plugin {
	public static function init(): void {
		Migration::init();
		CPT::init();
		Attributes::init();
		Render::init();
		Rest::init();
		BlockRegistry::init();
		Inserter::init();
		Assets::init();
		Propagate::init();
	}
}
