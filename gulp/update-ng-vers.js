// Gulp tasks related to updating the pubspec version of angular & sdk
'use strict';

module.exports = function (gulp, plugins, config) {

  const argv = plugins.argv;
  const ngPkgVers = config.ngPkgVers;
  const path = plugins.path;
  const replace = plugins.replace;

  function getBaseDir() {
    const p = argv.path ? path.resolve(argv.path) : path.resolve(config.EXAMPLES_ROOT);
    if (!plugins.fs.existsSync(p)) throw `Path DNE: ${p}`;
    return p;
  }

  // To update NG 3 code to NG 4 code use --ng-vers=4
  gulp.task('update-pubspec-etc', ['update-sdk-vers', 'update-pkg-vers']);

  //---------------------------------------------------------------------------
  // Updating SDK version

  const SDK_VERS = '>=1.24.0 <2.0.0';

  gulp.task('update-sdk-vers', cb => {
    const baseDir = getBaseDir();
    return gulp.src([
      `${baseDir}/**/pubspec.yaml`,
      `!${baseDir}/**/.pub/**`,
    ]) // , { base: baseDir }
      .pipe(replace(/^(\s+sdk): ['"][^'"]+['"]/m, `$1: '${SDK_VERS}'`))
      .pipe(gulp.dest(baseDir));
  });

  //---------------------------------------------------------------------------
  // Updating ACX and NG versions

  console.log('Using package versions:');
  for (var pkg in ngPkgVers) { console.log(`  ${pkg}: ${ngPkgVers[pkg].vers}`); }

  gulp.task('update-pkg-vers', ['update-sdk-vers', '_remove_platform_entries_etc', '_update-dart'], cb => {
    const baseDir = getBaseDir();
    return gulp.src([
      `${baseDir}/**/pubspec.yaml`,
      `!${baseDir}/**/.pub/**`,
    ]) // , { base: baseDir }
      .pipe(replace(/(^\s*- angular)2:$/gm, '$1:'))
      .pipe(replace(/(^\s+)(angular\w*):\s+(\S+)$/gm, pkgEntry))
      .pipe(gulp.dest(baseDir));
  });

  function pkgEntry(match, indent, pkg, currentVers) {
    if (argv.ngVers >= '4' || ngPkgVers['angular'].vers[0] >= '4') {
      pkg = pkg.replace(/^angular2/, 'angular');
    }
    let vers = ngPkgVers[pkg] ? mkVers(pkg) : currentVers;
    return `${indent}${pkg}: ${vers}`;
  }

  function mkVers(pkg) {
    let vers = ngPkgVers[pkg].vers;
    // ^ is meaningless when the major version number is 0; see http://semver.org/#spec-item-4
    // Apparently pub interprets ^ even when the major vers is 0.
    // return vers[0] != '0' ? `^${vers}` : vers;
    return `^${vers}`;
  }

  const depOvr = `
dependency_overrides:
  angular:
    git:
      url: https://github.com/dart-lang/angular.git
      path: angular
  angular_compiler:
    git:
      url: https://github.com/dart-lang/angular.git
      path: angular_compiler
  angular_forms:
    git:
      url: https://github.com/dart-lang/angular.git
      path: angular_forms
  angular_router:
    git:
      url: https://github.com/dart-lang/angular.git
      path: angular_router
  angular_test:
    git:
      url: https://github.com/dart-lang/angular.git
      path: angular_test
  build: ^0.10.0
  build_barback: ^0.4.0

`;
  /* Alt:
  git:
    url: https://github.com/dart-lang/some-pkg.git
    ref: 1.2.3
  */

  gulp.task('_dep_overrides', cb => {
    const baseDir = getBaseDir();
    return gulp.src([
      `${baseDir}/**/pubspec.yaml`,
      `!${baseDir}/**/.pub/**`,
    ]) // , { base: baseDir }
      .pipe(replace(/\btransformers:/, `${depOvr}$&`))
      .pipe(gulp.dest(baseDir));
  });

  gulp.task('_remove_overrides', cb => {
    const baseDir = getBaseDir();
    return gulp.src([
      `${baseDir}/**/pubspec.yaml`,
      `!${baseDir}/**/.pub/**`,
    ]) // , { base: baseDir }
      .pipe(replace(/\ndependency_overrides:\n(\s+[\s\S]*?\n)+\n/, ''))
      .pipe(gulp.dest(baseDir));
  });

  const platform_star =
    `    platform_directives:
    - 'package:angular2?/common.dart#COMMON_DIRECTIVES'
    platform_pipes:
    - 'package:angular2?/common.dart#COMMON_PIPES'
`;

  gulp.task('_remove_platform_entries_etc', ['update-sdk-vers'], cb => {
    const baseDir = getBaseDir();
    return gulp.src([
      `${baseDir}/**/pubspec.yaml`,
      `!${baseDir}/**/.pub/**`,
    ]) // , { base: baseDir }
      .pipe(replace(new RegExp(platform_star), ''))
      .pipe(replace(/\s+resolved_identifiers:(\s+\w+: .*)+/g, ''))
      .pipe(gulp.dest(baseDir));
  });

  const formsImport = "import 'package:angular_forms/angular_forms.dart';"

  gulp.task('_update-dart', ['update-sdk-vers'], cb => {
    const baseDir = getBaseDir();
    return gulp.src([
      `${baseDir}/**/*.dart`,
      `${baseDir}/**/*.html`,
      `${baseDir}/**/*.css`,
      `!${baseDir}/**/{.pub,build,node_modules}/**`,
      `!${baseDir}/**/ng/doc/*/web/styles.css`,
    ]) // , { base: baseDir }
      .pipe(replace(/angular2\/(angular2|common|platform\/browser|platform\/common).dart/g, 'angular/angular.dart'))
      .pipe(replace(/angular2\/router.dart/g, 'angular_router/angular_router.dart'))
      .pipe(replace(/(import 'package:angular\/angular.dart';)([\s\S]*)FORM_DIRECTIVES/, `$1\n${formsImport}$2formDirectives`))
      .pipe(replace(/FORM_DIRECTIVES/g, 'formDirectives'))
      .pipe(replace(/(import 'package:angular\/angular.dart';)([\s\S]*)COMMON_DIRECTIVES/, `$1\n${formsImport}$2CORE_DIRECTIVES, formDirectives`))
      .pipe(replace(/COMMON_DIRECTIVES/g, 'CORE_DIRECTIVES, formDirectives'))
      // .pipe(replace(/\bElementRef\b/g, 'Element'))
      .pipe(replace(/\/deep\//g, ':ng-deep'))
      .pipe(gulp.dest(baseDir));
  });

  gulp.task('update-pubspec-lock', cb => {
    if (!argv.package) plugins.logAndExit1(`Missing --package='pkg version' option`);
    const parts = argv.package.split(' ');
    if (parts.length !== 2) plugins.logAndExit1(`Invalid --package='pkg version' option: ${argv.package}`);
    const pkg = parts[0], vers = parts[1];

    const re = new RegExp(`(^  ${pkg}:[\\s\\S]+?version): \\S+$`, 'm');
    const baseDir = argv.path ? getBaseDir() : './{examples,src/_data}';
    // plugins.gutil.log('Will up')
    return gulp.src([
      `${baseDir}/**/pubspec.lock`,
      `!${baseDir}/**/{.pub,build,node_modules}/**`,
    ]) // , { base: baseDir }
      .pipe(replace(re, `$1: "${vers}"`))
      .pipe(gulp.dest('./'));
  });

  function baseHref(match, indent, oldScript) {
    return scriptBaseHref.map(s => indent + s).join('\n');
  }

  gulp.task('_update-base-href', cb => {
    const baseDir = getBaseDir();
    return gulp.src([
      `${baseDir}/**/index.html`,
      `!${baseDir}/**/{.pub,build,node_modules}/**`,
    ]) // , { base: baseDir }
      .pipe(replace(/( +)(<script>[\s\S]*?base href[\s\S]*?\s+<\/script>)/, baseHref))
      .pipe(gulp.dest(baseDir));
  });

};

const scriptBaseHref =
`<script>
  // WARNING: DO NOT set the <base href> like this in production!
  // Details: https://webdev.dartlang.org/angular/guide/router
  (function () {
    var m = document.location.pathname.match(/^(\\/[-\\w]+)+\\/web($|\\/)/);
    document.write('<base href="' + (m ? m[0] : '/') + '" />');
  }());
</script>`.split('\n');
