import React from 'react';
import { Switch } from '@headlessui/react';

function ModeToggle({ isVisualizeMode, onChange }) {
  return (
    <div className="flex items-center">
      <Switch
        checked={isVisualizeMode}
        onChange={onChange}
        className={`${
          isVisualizeMode ? 'bg-blue-600' : 'bg-gray-200'
        } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
      >
        <span className="sr-only">Toggle visualization mode</span>
        <span
          className={`${
            isVisualizeMode ? 'translate-x-6' : 'translate-x-1'
          } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
        />
      </Switch>
      <span className="ml-2 text-sm text-gray-700">
        {isVisualizeMode ? 'Visualize Mode' : 'Fetch Mode'}
      </span>
    </div>
  );
}

export default ModeToggle;