import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { generateBashCompletion, generateZshCompletion, installCompletions } from '../../src/cli/completions.js';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';

describe('Shell Completion Generation', () => {

  describe('bash completion', () => {
    test('generates valid bash completion script', () => {
      const script = generateBashCompletion();
      expect(script).toContain('_agent_computer_completions()');
      expect(script).toContain('complete -o default -F _agent_computer_completions agent-computer');
    });

    test('includes all major commands', () => {
      const script = generateBashCompletion();
      for (const cmd of ['snapshot', 'click', 'type', 'scroll', 'daemon', 'grab', 'windows', 'apps']) {
        expect(script).toContain(cmd);
      }
    });

    test('includes subcommands for daemon', () => {
      const script = generateBashCompletion();
      expect(script).toContain('start');
      expect(script).toContain('stop');
      expect(script).toContain('restart');
    });

    test('includes global flags', () => {
      const script = generateBashCompletion();
      expect(script).toContain('--json');
      expect(script).toContain('--timeout');
      expect(script).toContain('--verbose');
    });

    test('includes command-specific flags', () => {
      const script = generateBashCompletion();
      expect(script).toContain('--right');   // click
      expect(script).toContain('--smooth');  // scroll
      expect(script).toContain('--retina');  // screenshot
    });
  });

  describe('zsh completion', () => {
    test('generates valid zsh completion script', () => {
      const script = generateZshCompletion();
      expect(script).toContain('#compdef agent-computer');
      expect(script).toContain('_agent-computer()');
      expect(script).toContain('_agent-computer "$@"');
    });

    test('includes command descriptions', () => {
      const script = generateZshCompletion();
      expect(script).toContain('snapshot:Snapshot accessibility tree');
      expect(script).toContain('click:Click an element');
      expect(script).toContain('daemon:Manage daemon');
    });

    test('includes subcommand completion', () => {
      const script = generateZshCompletion();
      expect(script).toContain("'start'");
      expect(script).toContain("'stop'");
      expect(script).toContain("daemon subcommand");
    });
  });

  describe('completion install', () => {
    const testHome = join(tmpdir(), `ac-test-completions-${process.pid}`);

    beforeEach(() => {
      mkdirSync(testHome, { recursive: true });
      writeFileSync(join(testHome, '.zshrc'), '# test zshrc\n');
      writeFileSync(join(testHome, '.bashrc'), '# test bashrc\n');
    });

    afterEach(() => {
      rmSync(testHome, { recursive: true, force: true });
    });

    test('creates completion files', () => {
      installCompletions(testHome);
      const completionsDir = join(testHome, '.agent-computer', 'completions');

      expect(existsSync(join(completionsDir, '_agent-computer'))).toBe(true);
      expect(existsSync(join(completionsDir, 'agent-computer.bash'))).toBe(true);

      const zshContent = readFileSync(join(completionsDir, '_agent-computer'), 'utf8');
      expect(zshContent).toContain('#compdef agent-computer');

      const bashContent = readFileSync(join(completionsDir, 'agent-computer.bash'), 'utf8');
      expect(bashContent).toContain('complete -o default');
    });

    test('is idempotent — does not duplicate rc entries', () => {
      installCompletions(testHome);
      installCompletions(testHome);

      const zshrc = readFileSync(join(testHome, '.zshrc'), 'utf8');
      const matches = zshrc.match(/agent-computer shell completions/g);
      expect(matches?.length).toBe(1);
    });

    test('skips compinit if already present in zshrc', () => {
      writeFileSync(join(testHome, '.zshrc'), '# test\nautoload -Uz compinit && compinit\n');
      installCompletions(testHome);

      const zshrc = readFileSync(join(testHome, '.zshrc'), 'utf8');
      // The added snippet should NOT contain compinit since it's already in the file
      const addedSnippet = zshrc.split('# agent-computer shell completions')[1];
      expect(addedSnippet).not.toContain('compinit');
    });

    test('adds compinit if not present in zshrc', () => {
      writeFileSync(join(testHome, '.zshrc'), '# bare zshrc\n');
      installCompletions(testHome);

      const zshrc = readFileSync(join(testHome, '.zshrc'), 'utf8');
      const addedSnippet = zshrc.split('# agent-computer shell completions')[1];
      expect(addedSnippet).toContain('compinit');
    });
  });

  describe('shell syntax validation', () => {
    function shellExists(shell: string): boolean {
      try {
        execFileSync('which', [shell], { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    }

    test('bash completion script is syntactically valid', () => {
      const hasBash = shellExists('bash');
      if (!hasBash) return; // skip in CI environments without bash

      const script = generateBashCompletion();
      const tmpFile = join(tmpdir(), `ac-bash-check-${process.pid}.bash`);
      writeFileSync(tmpFile, script);
      try {
        execFileSync('bash', ['-n', tmpFile], { stdio: 'pipe' });
      } finally {
        rmSync(tmpFile, { force: true });
      }
    });

    test('zsh completion script is syntactically valid', () => {
      const hasZsh = shellExists('zsh');
      if (!hasZsh) return; // skip in CI environments without zsh

      const script = generateZshCompletion();
      const tmpFile = join(tmpdir(), `ac-zsh-check-${process.pid}.zsh`);
      writeFileSync(tmpFile, script);
      try {
        execFileSync('zsh', ['-n', tmpFile], { stdio: 'pipe' });
      } finally {
        rmSync(tmpFile, { force: true });
      }
    });
  });
});
