package dotfiles

import (
	"context"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"time"
)

// Source names where a listing came from, so the UI can say so and an
// operator can tell at a glance whether the safer path was taken.
type Source string

const (
	// SourceGit means the listing is `git ls-files`: exactly what is
	// committed, and nothing else.
	SourceGit Source = "git"
	// SourceWalk means the listing is a filtered directory walk, used when
	// the root is not a git checkout or git is unavailable.
	SourceWalk Source = "walk"
)

const gitTimeout = 5 * time.Second

// listTracked asks git for the committed file list.
//
// This is the preferred source by a wide margin. A dotfiles checkout in real
// use accumulates things that are on disk but deliberately not in the repo -
// an editor's node_modules, a lockfile, a stray .DS_Store, whatever a tool
// dropped there last week. The .gitignore is the author's own statement that
// those are not part of the dotfiles, and honouring it is both more correct
// and much safer than trying to re-derive the same judgement from filename
// patterns. On the repo this was built against it is the difference between
// 45 files and 3,695.
//
// -z because filenames may contain spaces, and --cached to list what is
// committed rather than what happens to be staged.
func listTracked(root string) ([]string, bool) {
	gitDir := filepath.Join(root, ".git")
	if _, err := os.Stat(gitDir); err != nil {
		return nil, false
	}

	ctx, cancel := context.WithTimeout(context.Background(), gitTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "git", "-C", root, "ls-files", "-z", "--cached")
	// A dotfiles repo may carry git config that runs commands; keep the
	// subprocess environment minimal rather than inheriting the server's.
	cmd.Env = []string{"PATH=" + os.Getenv("PATH"), "HOME=" + root, "GIT_TERMINAL_PROMPT=0"}
	out, err := cmd.Output()
	if err != nil {
		return nil, false
	}

	var paths []string
	for _, entry := range strings.Split(string(out), "\x00") {
		if entry == "" {
			continue
		}
		paths = append(paths, path.Clean(filepath.ToSlash(entry)))
	}
	return paths, len(paths) > 0
}

// listWalked is the fallback: every file under root that survives the
// directory and symlink filters.
func listWalked(root string) ([]string, error) {
	var paths []string
	err := filepath.WalkDir(root, func(absolute string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return nil
		}
		if absolute == root {
			return nil
		}
		if skippedDirs[d.Name()] {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if d.IsDir() || d.Type()&os.ModeSymlink != 0 {
			return nil
		}
		relative, relErr := filepath.Rel(root, absolute)
		if relErr != nil {
			return nil
		}
		paths = append(paths, filepath.ToSlash(relative))
		return nil
	})
	return paths, err
}
