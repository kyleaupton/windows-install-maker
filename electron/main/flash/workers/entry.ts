import { parentPort, workerData } from 'worker_threads';
import { workers } from '.';
import { SerializedFlash } from '@shared/flash';

if (parentPort && workerData) {
  try {
    if (
      typeof workerData !== 'object' ||
      !['type', 'options', 'state'].every((key) => key in workerData)
    ) {
      throw new Error('Invalid worker data');
    }

    // Flash job type
    const type = workerData.type as keyof typeof workers;
    // Flash job options
    const options = workerData.options as Parameters<
      (typeof workers)[typeof type]
    >[1];

    // Function to run the flash job
    const func = workers[type];
    if (!func) {
      throw new Error(`Worker type ${type} not found`);
    }

    const state = { ...workerData.state } as SerializedFlash;

    const id = setInterval(() => {
      parentPort!.postMessage({
        type: 'state',
        data: state,
      });
    }, 500);

    func(state, options)
      .then((res) => {
        parentPort!.postMessage({
          type: 'result',
          data: res,
        });
      })
      .catch((error) => {
        throw error;
      });

    clearInterval(id);
  } catch (error) {
    console.error(error);
    parentPort.postMessage({
      type: 'error',
      data: error,
    });
  }
}
