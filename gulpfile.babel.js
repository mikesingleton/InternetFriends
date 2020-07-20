// generated on 2020-06-21 using generator-chrome-extension 0.7.2
import gulp from 'gulp';
import gulpLoadPlugins from 'gulp-load-plugins';
import browserify from "browserify";
import del from 'del';
import fs from 'fs';
import runSequence from 'run-sequence';
import {stream as wiredep} from 'wiredep';

const $ = gulpLoadPlugins();

gulp.task('default', ['clean'], cb => {
  runSequence('build', cb);
});

gulp.task('build', (cb) => {
  runSequence(
    'lint', 'babel', 'browserify',
    'extension', 
    'website',
    'cleanScripts', cb);
});

function lint(files, options) {
  return () => {
    return gulp.src(files)
      .pipe($.eslint(options))
      .pipe($.eslint.format());
  };
}

gulp.task('lint', lint('app/scripts.babel*.js', {
  env: {
    es6: true
  }
}));

gulp.task('babel', () => {
  return gulp.src('app/scripts.babel/**/*.js')
      .pipe($.plumber())
      .pipe($.babel({
        presets: ['@babel/env']
      }))
      .pipe(gulp.dest('app/scripts'));
});

gulp.task('clean', del.bind(null, ['.tmp', 'dist', 'website']));
gulp.task('cleanScripts', del.bind(null, ['app/scripts']));

gulp.task('watch', ['lint', 'babel'], () => {
  $.livereload.listen();

  gulp.watch([
    'app/*.html',
    'app/scripts/**/*.js',
    'app/images/**/*',
    'app/styles/**/*',
    'app/_locales/**/*.json'
  ]).on('change', $.livereload.reload);

  gulp.watch('app/scripts.babel/**/*.js', ['lint', 'babel']);
  gulp.watch('bower.json', ['wiredep']);
});

gulp.task('browserify', () => {
  return browserify({
    entries: 'app/scripts/background.js',
    debug: true
  })
  .bundle()
  .pipe(fs.createWriteStream('app/scripts/bundle.js'));
});

gulp.task('wiredep', () => {
  gulp.src('app/*.html')
    .pipe(wiredep({
      ignorePath: /^(\.\.\/)*\.\./
    }))
    .pipe(gulp.dest('app'));
});

// extension -----------------------------------------------------------------	
gulp.task('extension', (cb) => {
  return runSequence(
    'extension.scripts','chromeManifest',
    'extension.res', 'extension.html', 'extension.images',
    'extras', 'size', cb
  );
});

gulp.task('extension.scripts', () => {
  return gulp.src('app/extension/scripts/**/*.js')
      .pipe($.plumber())
      .pipe($.babel({
        presets: ['@babel/env']
      }))
      .pipe(gulp.dest('app/scripts'));
});

gulp.task('package', function () {
  var manifest = require('./dist/manifest.json');
  return gulp.src('dist/**')
      .pipe($.zip('InternetFriends-' + manifest.version + '.zip'))
      .pipe(gulp.dest('package'));
});

gulp.task('extension.images', () => {
  return gulp.src('app/extension/images/**/*')
    .pipe($.if($.if.isFile, $.cache($.imagemin({
      progressive: true,
      interlaced: true,
      // don't remove IDs from SVGs, they are often used
      // as hooks for embedding and styling
      svgoPlugins: [{cleanupIDs: false}]
    }))
    .on('error', function (err) {
      Logger.log(err);
      this.end();
    })))
    .pipe(gulp.dest('dist/images'));
});

gulp.task('extension.html',  () => {
  return gulp.src('**/*.html', { cwd: './app/extension/', base: './app/extension/' })
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
    .pipe(gulp.dest('dist'));
});

gulp.task('extension.res', function() {
  const manifest = require('./app/manifest.json');
  var log = require('fancy-log');
  var debug = require('gulp-debug');
  return gulp.src(manifest.web_accessible_resources, { cwd: './app/', base: './app/' })
    .pipe(debug())
    .pipe($.if('*.css', $.cleanCss({compatibility: '*'})))
    .pipe($.if('*.js', $.sourcemaps.init()))
    .pipe($.if('*.js', $.uglify()))
    .pipe($.if('*.js', $.sourcemaps.write('.')))
    .pipe(gulp.dest('dist'));
});

gulp.task('chromeManifest', () => {
  var debug = require('gulp-debug');
  return gulp.src('app/manifest.json')
    .pipe($.chromeManifest({
      buildnumber: true
  }))
  .pipe(debug())
  .pipe($.if('*.css', $.cleanCss({compatibility: '*'})))
  .pipe($.if('*.js', $.sourcemaps.init()))
  .pipe($.if('*.js', $.uglify()))
  .pipe($.if('*.js', $.sourcemaps.write('.')))
  .pipe(gulp.dest('dist'));
});

gulp.task('size', () => {
  return gulp.src('dist/**/*').pipe($.size({title: 'build', gzip: true}));
});

gulp.task('extras', () => {
  return gulp.src([
    'app/*.*',
    'app/_locales/**',
    '!app/scripts.babel',
    '!app/*.json',
    '!app/*.html',
  ], {
    base: 'app',
    dot: true
  }).pipe(gulp.dest('dist'));
});

// website -----------------------------------------------------------------	
gulp.task('website', (cb) => {
  return runSequence(
    'website.manifest', 'website.scripts', 'website.extras',
    cb
  );
});

gulp.task('website.manifest', function() {
  const manifest = require('./app/manifest.json');
  return gulp.src([
      '!*.html',
      ...manifest.web_accessible_resources,
      ...manifest.content_scripts[0].css,
      ...manifest.content_scripts[0].js,
      ...manifest.background.scripts
    ], { cwd: './app/', base: './app/' })
    .pipe($.if('*.css', $.cleanCss({compatibility: '*'})))
    .pipe($.if('*.js', $.sourcemaps.init()))
    .pipe($.if('*.js', $.uglify()))
    .pipe($.if('*.js', $.sourcemaps.write('.')))
    .pipe(gulp.dest('./website'));
});

gulp.task('website.scripts', () => {
  return gulp.src('app/website/scripts/**/*.js')
    .pipe($.plumber())
    .pipe($.babel({
      presets: ['@babel/env']
    }))
    .pipe($.if('*.js', $.sourcemaps.init()))
    .pipe($.if('*.js', $.uglify()))
    .pipe($.if('*.js', $.sourcemaps.write('.')))
    .pipe(gulp.dest('website/scripts'));
});

gulp.task('website.extras', () => {
  return gulp.src(['!*.js', '**/*'], { cwd: './app/website/', base: './app/website/' })
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
  .pipe(gulp.dest('website'));
});
