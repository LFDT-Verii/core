/* eslint-disable better-mutation/no-mutation */
/**
 * Copyright 2023 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const download = (fileName, onLoading, onError, onClick, callback) => {
  // eslint-disable-next-line no-undef
  const request = new XMLHttpRequest();
  request.responseType = 'blob';
  request.open('GET', fileName);

  request.addEventListener('load', () => {
    callback();
  });
  request.onloadstart = () => {
    onClick(true);
    onLoading(true);
  };
  request.onloadend = () => {
    onLoading(false);
  };
  request.onerror = () => {
    onError(true);
  };
  request.onabort = () => {
    onError(true);
  };

  request.send();
};
/* eslint-disable better-mutation/no-mutation */
const downloadTxtAsFile = (text, name) => {
  // eslint-disable-next-line no-undef
  const a = document.createElement('a');
  const file = new Blob([text], { type: 'application/json' });

  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  a.remove();
};

export default (fileName, text, onLoading, onError, onClick) => {
  download(fileName, onLoading, onError, onClick, () => {
    downloadTxtAsFile(text, fileName);
  });
};
