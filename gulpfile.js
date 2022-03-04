const { src, dest, series } = require('gulp');
const del = require('del');
const gulpLoadPlugins = require('gulp-load-plugins');
const $ = gulpLoadPlugins();
const plumber = require('gulp-plumber');
const browserify = require('browserify');
const fs = require('fs');

function lint(files, options) {
  return () => {
    return gulp.src(files)
      .pipe($.eslint(options))
      .pipe($.eslint.format());
  };
}

function jsLint(cb) {
  lint('app/scripts.babel*.js', {
    env: {
      es6: true
    }
  });
  cb();
}

function jsBabel() {
  return src('app/scripts.babel/**/*.js')
    .pipe(plumber())
    .pipe($.babel({
      presets: ['@babel/env']
    }))
    .pipe(dest('app/scripts'));
}

function jsBrowserify() {
  return browserify({
    entries: 'app/scripts/background.js',
    debug: true
  })
  .bundle()
  .pipe(fs.createWriteStream('app/scripts/bundle.js'));
}

// extension -----------------------------------------------------------------	
function jsExtension(cb) {
  series(extensionScripts, chromeManifest,
    res, extensionHtml, extensionImages,
    extras, size)(cb);
}

function chromeManifest(cb) {
  var manifest = require('gulp-chrome-manifest');
  var debug = require('gulp-debug');
  return src('app/manifest.json')
    .pipe(manifest({
      buildnumber: true
    }))
    .pipe(debug())
    .pipe($.if('*.css', $.cleanCss({compatibility: '*'})))
    .pipe($.if('*.js', $.sourcemaps.init()))
    .pipe($.if('*.js', $.uglify()))
    .pipe($.if('*.js', $.sourcemaps.write('.')))
    .pipe(dest('dist'));
}

function res(cb) {
  const manifest = require('./app/manifest.json');
  var log = require('fancy-log');
  var debug = require('gulp-debug');
  return src(manifest.web_accessible_resources, { cwd: './app/', base: './app/', allowEmpty: true })
    .pipe(debug())
    .pipe($.if('*.css', $.cleanCss({compatibility: '*'})))
    .pipe($.if('*.js', $.sourcemaps.init()))
    .pipe($.if('*.js', $.uglify()))
    .pipe($.if('*.js', $.sourcemaps.write('.')))
    .pipe(dest('dist'));
}

function extensionHtml(cb) {
  return src('**/*.html', { cwd: './app/extension/', base: './app/extension/' })
    .pipe($.useref({searchPath: ['.tmp', 'app', '.']}))
    .pipe($.sourcemaps.init())
    .pipe($.if('*.js', $.uglify()))
    .pipe($.if('*.css', $.cleanCss({compatibility: '*'})))
    .pipe($.sourcemaps.write())
    .pipe($.if('*.html', $.htmlmin({
      collapseWhitespace: true,
      minifyCSS: true,
      minifyJS: true,
      removeComments: true
    })))
    .pipe(dest('dist'));
}

function extensionImages(cb) {
  return src('app/extension/images/**/*').pipe(dest('dist/images'));
}

function extras(cb) {
  return src([
    'app/*.*',
    'app/extension/fonts/**',
    'app/_locales/**',
    '!app/scripts.babel',
    '!app/*.json',
    '!app/*.html',
  ], {
    base: 'app',
    dot: true
  }).pipe(dest('dist'));
}

function size(cb) {
  return src('dist/**/*').pipe($.size({title: 'build', gzip: true}));
}

function extensionScripts(cb) {
  return src('app/extension/scripts/**/*.js')
      .pipe(plumber())
      .pipe(dest('app/scripts'));
}

function package(cb) {
  var manifest = require('./dist/manifest.json');
  return gulp.src('dist/**')
      .pipe($.zip('InternetFriends-' + manifest.version + '.zip'))
      .pipe(gulp.dest('package'));
}

// website -----------------------------------------------------------------	
function jsWebsite(cb) {
  series(websiteManifest, websiteScripts, websiteExtras)(cb);
}

function websiteManifest(cb){
  const manifest = require('./app/manifest.json');
  return src([
      '!*.html',
      ...manifest.web_accessible_resources,
      ...manifest.content_scripts[0].css,
      ...manifest.content_scripts[0].js
    ], { cwd: './app/', base: './app/', allowEmpty: true })
    .pipe($.if('*.css', $.cleanCss({compatibility: '*'})))
    .pipe($.if('*.js', $.sourcemaps.init()))
    .pipe($.if('*.js', $.uglify()))
    .pipe($.if('*.js', $.sourcemaps.write('.')))
    .pipe(dest('./website'));
}

function websiteScripts(cb){
  return src('app/website/scripts/**/*.js')
    .pipe($.plumber())
    .pipe($.babel({
      presets: ['@babel/env']
    }))
    .pipe($.if('*.js', $.sourcemaps.init()))
    .pipe($.if('*.js', $.uglify()))
    .pipe($.if('*.js', $.sourcemaps.write('.')))
    .pipe(dest('website/scripts'));
}

function websiteExtras(cb){
  return src(['!*.js', '**/*'], { cwd: './app/website/', base: './app/website/' })
    .pipe($.sourcemaps.init())
    .pipe($.if('*.js', $.uglify()))
    .pipe($.if('*.css', $.cleanCss({compatibility: '*'})))
    .pipe($.sourcemaps.write())
    .pipe($.if('*.html', $.htmlmin({
      collapseWhitespace: true,
      minifyCSS: true,
      minifyJS: true,
      removeComments: true
    })))
    .pipe(dest('website'));
}

// exports -------------------------------------------------------------------
function clean(cb) {
  del.sync(['.tmp', 'cleanScripts', 'website', 'dist']);
  cb();
}

function cleanScripts(cb) {
  del.sync(['app/scripts']);
  cb();
}

exports.clean = clean;
exports.extension = jsExtension;
exports.website = jsWebsite;
exports.package = package;

exports.default = series(clean,
  jsLint, jsBabel, jsBrowserify,
  jsExtension, jsWebsite, cleanScripts
);