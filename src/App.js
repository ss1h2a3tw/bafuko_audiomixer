import React from 'react';

const META_URL = 'https://audio_bafuko_moe.storage.googleapis.com/meta.json';
const SAMPLE_RATE = 44100;

var AudioContext = window.AudioContext || window.webkitAudioContext;
var OfflineAudioContext = window.OfflineAudioContext;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      metaLoaded: false,
      audioRendered: false,
      audioLoaded: [],
      audioLoading: [],
    };
    this.audio = [];
  }
  componentDidMount() {
    this.actx = new AudioContext();
    this.mainNode = this.actx.createBufferSource();
    fetch(META_URL)
      .then((res) => res.json())
      .then((res) => {
        let pendingToLoad = [];
        this.audio = res;
        for (let audioElement of res) {
          audioElement['gain'] = 1;
          audioElement['length'] = 0;
          audioElement['sampleRate'] = 0;
          audioElement['offset'] = 0;
          audioElement['loaded'] = false;
          audioElement['loading'] = false;
        }
        let nextState = {
          metaLoaded: true,
          audioLoaded: [],
          audioLoading: [],
        };
        for (const idx in res) {
          nextState.audioLoaded.push(false);
          nextState.audioLoading.push(res[idx].default);
          this.audio[idx].loading = res[idx].default;
          if (res[idx].default) {
            pendingToLoad.push(idx);
          }
        }
        this.setState(nextState, () => {
          for (const idx of pendingToLoad) {
            this.loadAudio(idx);
          }
        });
      });
  }
  setAudioLoaded(idx) {
    this.audio[idx].loaded = true;
    this.audio[idx].loading = false;
    let allLoaded = this.audio.every((element) => {
      return !element.loading;
    });
    if (allLoaded) {
      this.renderAudio();
    }
    this.setState((prevState) => {
      let nextAudioLoaded = [...prevState.audioLoaded];
      let nextAudioLoading = [...prevState.audioLoading];
      nextAudioLoaded[idx] = true;
      nextAudioLoading[idx] = false;
      return {
        audioLoaded: nextAudioLoaded,
        audioLoading: nextAudioLoading,
      };
    });
  }
  loadAudio(idx) {
    let audio = this.audio[idx];
    fetch(audio.url)
      .then((res) => res.blob())
      .then((res) => {
        audio.blob = res;
        return res.arrayBuffer();
      })
      .then((res) => this.actx.decodeAudioData(res))
      .then((buffer) => {
        audio.length = buffer.length;
        audio.sampleRate = buffer.sampleRate;
        this.setAudioLoaded(idx);
      });
  }
  renderAudio() {
    // max sample count (as SAMPLE_RATE)
    let maxLength = 0;
    // get the min negative offset
    let minOffset = 0;
    for (const element of this.audio) {
      if (element.loaded) {
        const length = element.length * (SAMPLE_RATE / element.sampleRate);
        minOffset = Math.min(minOffset, element.offset);
        maxLength = Math.max(maxLength, length);
      }
    }
    // from ms to sample count and make it positive
    minOffset *= -(SAMPLE_RATE / 1000);
    let actx = new OfflineAudioContext(2, maxLength + minOffset, SAMPLE_RATE);
    this.offlineActx = actx;
    let promise = [];
    for (const element of this.audio) {
      if (element.loaded) {
        let current = element.blob
          .arrayBuffer()
          .then((arrayBuffer) => actx.decodeAudioData(arrayBuffer))
          .then((audioBuffer) => {
            let sourceNode = actx.createBufferSource();
            sourceNode.buffer = audioBuffer;
            sourceNode.connect(actx.destination);
            sourceNode.start(minOffset + element.offset * (SAMPLE_RATE / 1000));
          });
        promise.push(current);
      }
    }
    Promise.all(promise).then(() => {
      actx.startRendering().then((buffer) => {
        console.log('Rendering completed successfully');
        this.mainNode.buffer = buffer;
        this.mainNode.connect(this.actx.destination);
        this.setState({ audioRendered: true });
      });
    });
  }
  play() {
    this.mainNode.start();
  }
  render() {
    if (!this.state.metaLoaded) {
      return <>LOADING!</>;
    } else if (!this.state.audioRendered) {
      return <>RENDERING!</>;
    } else {
      return (
        <>
          {this.filesize}
          <button onClick={this.play.bind(this)}>PLAY</button>
        </>
      );
    }
  }
}
export default App;
