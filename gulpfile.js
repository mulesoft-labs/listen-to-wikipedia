const gulp = require('gulp');
const ghPages = require('gulp-gh-pages');
const dist = './static/**/*';

gulp.task('deploy', function() {
  return gulp.src(dist)
    .pipe(ghPages());
});
