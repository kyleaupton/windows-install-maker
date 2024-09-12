import { BrowserWindow } from 'electron';
import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import { SerializedFlash } from '@shared/flash';

import { _Workers } from './workers';

export default class Flash<
  T extends keyof _Workers,
  V extends Parameters<_Workers[T]>[1],
> {
  id: string;
  type: T;
  options: V;
  #state: SerializedFlash;
  worker: Worker | undefined;

  constructor(id: string, type: T, options: NoInfer<V>) {
    this.id = id;
    this.type = type;
    this.options = options;
    this.#state = {
      id,
      status: '',
      done: false,
      canceled: false,
      progress: {
        activity: '',
        transferred: -1,
        speed: -1,
        percentage: -1,
        eta: -1,
      },
    };
  }

  get state() {
    return this.#state;
  }

  set state(state: Partial<SerializedFlash>) {
    this.#state = { ...this.#state, ...state };
    this.sendState();
  }

  start() {
    this.worker = new Worker(
      join(process.env.DIST_ELECTRON, 'main', 'entry.js'),
      {
        workerData: {
          type: this.type,
          state: this.state,
          options: this.options,
        },
      },
    );

    this.worker.on('message', (message) => {
      if (message.type === 'state') {
        this.state = message.data;
      } else if (message.type === 'result') {
        this.state.done = true;
      } else if (message.type === 'error') {
        this.state.status = message.data;
      }
    });

    this.worker.on('error', (error) => {
      console.log(error);
    });
  }

  async cancel() {
    if (this.worker) {
      await this.worker.terminate();
    }
  }

  sendState() {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('/flash/update', this.state);
    });
  }
}
