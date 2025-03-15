/*eslint-disable no-unused-lets*/
/*global d3*/

/**
 * Helper function for loading one or more sound files
 */
const loadSounds = (obj, context, soundMap, callback) => {
    const names = [];
    const paths = [];
    for (const name in soundMap) {
        const path = soundMap[name];
        names.push(name);
        paths.push(path);
    }
    
    const bufferLoader = new BufferLoader(context, paths, (bufferList) => {
        for (let i = 0; i < bufferList.length; i++) {
            const buffer = bufferList[i];
            const name = names[i];
            obj[name] = buffer;
        }
        if (callback) {
            callback();
        }
    });
    
    bufferLoader.load();
};

/**
 * Class that performs most of the work to load a new sound file asynchronously
 */
class BufferLoader {
    constructor(context, urlList, callback) {
        this.context = context;
        this.urlList = urlList;
        this.onload = callback;
        this.bufferList = [];
        this.loadCount = 0;
    }

    loadBuffer(url, index) {
        // Load buffer asynchronously
        const request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';

        request.onload = () => {
            // Asynchronously decode the audio file data
            this.context.decodeAudioData(
                request.response,
                (buffer) => {
                    if (!buffer) {
                        alert(`error decoding file data: ${url}`);
                        return;
                    }
                    this.bufferList[index] = buffer;
                    if (++this.loadCount === this.urlList.length) {
                        this.onload(this.bufferList);
                    }
                }
            );
        };

        request.onerror = () => {
            alert('BufferLoader: XHR error');
        };
        
        request.send();
    }

    load() {
        for (let i = 0; i < this.urlList.length; ++i) {
            this.loadBuffer(this.urlList[i], i);
        }
    }
}

/**
 * Spectrogram class
 */
class Spectrogram {
    constructor(filename, selector, options = {}) {
        this.options = options;

        const SMOOTHING = 0.0;
        const FFT_SIZE = 2048;

        this.sampleRate = options.sampleSize || 512;
        this.decRange = [-80.0, 80.0];

        this.width = options.width || 900;
        this.height = options.height || 440;
        this.margin = options.margin || {
            top: 20,
            right: 20,
            bottom: 30,
            left: 50
        };

        this.colorScheme = options.colorScheme || ['#ffffff', '#f0f0f0', '#d9d9d9', '#bdbdbd', '#969696', '#737373', '#525252', '#252525', '#000000'];
        this.zoomScale = 1;

        this.selector = selector;
        this.filename = filename;

        this.context = new(window.AudioContext)();

        // setup a analyzer
        this.analyser = this.context.createAnalyser();
        this.analyser.minDecibels = this.decRange[0];
        this.analyser.maxDecibels = this.decRange[1];
        this.analyser.smoothingTimeConstant = SMOOTHING;
        this.analyser.fftSize = FFT_SIZE;

        // mute the sound
        this.volume = this.context.createGain();
        this.volume.gain.value = 0;

        // Create a ScriptProcessorNode
        this.scriptNode = this.context.createScriptProcessor(this.sampleRate, 1, 1);

        this.freqs = new Uint8Array(this.analyser.frequencyBinCount);
        this.data = [];

        this.isPlaying = false;
        this.isLoaded = false;
        this.startTime = 0;
        this.count = 0;
        this.curSec = 0;
        this.maxCount = 0;

        loadSounds(this, this.context, {
            buffer: this.filename
        }, this.setupVisual.bind(this));
    }

    process() {
        if (this.isPlaying && !this.isLoaded) {
            this.count += 1;
            this.curSec = (this.sampleRate * this.count) / this.buffer.sampleRate;
            this.analyser.getByteFrequencyData(this.freqs);

            const d = {
                'key': this.curSec,
                'values': new Uint8Array(this.freqs)
            };
            this.data.push(d);

            if (this.count >= this.maxCount) {
                this.draw();
                this.stop();
                this.isLoaded = true;
            }
        }
    }

    setupVisual() {
        // can configure these from the options
        this.timeRange = [0, this.buffer.duration];
        const maxFrequency = this.options.maxFrequency || this.getBinFrequency(this.analyser.frequencyBinCount);
        const minFrequency = this.options.minFrequency || this.getBinFrequency(0);
        this.freqRange = [minFrequency, maxFrequency];

        // zoom the x-axis and the scale of the canvas
        this.zoom = d3.zoom()
            .scaleExtent([1, parseInt(this.timeRange[1])])
            .translateExtent([
                [0, 0],
                [this.width, this.height]
            ])
            .extent([
                [0, 0],
                [this.width, this.height]
            ]).on('zoom', () => {
                this.zoomScale = d3.event.transform.k;
                this.xScale = d3.event.transform.rescaleX(this.orgXScale);
                this.gX.call(this.xAxis.scale(this.xScale));
                this.draw();
            });

        this.canvas = d3.select(this.selector)
            .append('canvas')
            .attr('class', 'vis_canvas')
            .attr('width', this.width)
            .attr('height', this.height)
            .style('padding', `${d3.map(this.margin).values().join('px ')}px`);

        this.svg = d3.select(this.selector)
            .append('svg')
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom)
            .call(this.zoom)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        // loading spinner
        this.spinner = this.svg.append('g')
            .attr('transform', `translate(${this.width / 2},${this.height / 2})`)
            .html('<path opacity="0.2" fill="#000" d="M20.201,5.169c-8.254,0-14.946,6.692-14.946,14.946c0,8.255,6.692,14.946,14.946,14.946   s14.946-6.691,14.946-14.946C35.146,11.861,28.455,5.169,20.201,5.169z M20.201,31.749c-6.425,0-11.634-5.208-11.634-11.634   c0-6.425,5.209-11.634,11.634-11.634c6.425,0,11.633,5.209,11.633,11.634C31.834,26.541,26.626,31.749,20.201,31.749z"/> <path fill="#000" d="M26.013,10.047l1.654-2.866c-2.198-1.272-4.743-2.012-7.466-2.012h0v3.312h0   C22.32,8.481,24.301,9.057,26.013,10.047z"> <animateTransform attributeType="xml" attributeName="transform" type="rotate" from="0 20 20" to="360 20 20" dur="0.5s" repeatCount="indefinite"/></path>');

        this.progressLine = this.svg.append('line')
            .attr('id', 'progress-line')
            .attr('x1', 0)
            .attr('x2', 0)
            .attr('y1', 0)
            .attr('y2', this.height);

        this.playButton = d3.select(this.selector)
            .append('button')
            .style('margin-top', `${this.height + this.margin.top + this.margin.bottom + 20}px`)
            .text('Play')
            .on('click', () => this.play());

        this.pauseButton = d3.select(this.selector)
            .append('button')
            .style('margin-top', `${this.height + this.margin.top + this.margin.bottom + 20}px`)
            .text('Pause')
            .on('click', () => this.pauseResume());

        this.stopButton = d3.select(this.selector)
            .append('button')
            .style('margin-top', `${this.height + this.margin.top + this.margin.bottom + 20}px`)
            .text('Stop')
            .on('click', () => this.stop());

        const freqs = [];
        for (let i = 64; i < this.analyser.frequencyBinCount; i += 64) {
            freqs.push(this.getBinFrequency(i).toFixed(4));
        }

        this.freqSelect = d3.select(this.selector)
            .append('select')
            .style('margin-top', `${this.height + this.margin.top + this.margin.bottom + 20}px`)
            .style('margin-left', '20px')
            .on('change', function() {
                const newFreq = this.options[this.selectedIndex].value;
                that.yScale.domain([0, newFreq]);
                that.draw();
            });

        this.freqSelect.selectAll('option')
            .data(freqs)
            .enter()
            .append('option')
            .attr('value', d => d)
            .attr('selected', d => (d == 22500) ? 'selected' : null)
            .text(d => `${Math.round(d / 1000)}k`);

        this.maxCount = (this.context.sampleRate / this.sampleRate) * this.buffer.duration;

        // original x scale
        this.orgXScale = d3.scaleLinear()
            .domain(this.timeRange)
            .range([0, this.width]);

        // needed for the zoom function
        this.xScale = this.orgXScale;

        this.yScale = d3.scaleLinear()
            .domain(this.freqRange)
            .range([this.height, 0]);

        this.zScale = d3.scaleQuantize()
            .domain(this.decRange)
            .range(this.colorScheme);

        const commasFormatter = d3.format(',.2f');
        this.xAxis = d3.axisBottom(this.xScale)
            .tickSize(-this.height - 15)
            .tickPadding(10)
            .tickFormat(d => `${commasFormatter(d)}s`);

        this.yAxis = d3.axisLeft(this.yScale)
            .tickSize(-this.width - 10, 0, 0)
            .tickPadding(10)
            .tickFormat(d => `${(d / 1000).toFixed(1)}k`);

        this.gX = this.svg.append('g')
            .attr('class', 'x axis')
            .attr('transform', `translate(0,${this.height})`)
            .call(this.xAxis);

        this.svg.append('g')
            .attr('class', 'y axis')
            .call(this.yAxis);

        this.play();
    }

    showProgress() {
        if (this.isPlaying && this.isLoaded) {
            this.curDuration = (this.context.currentTime - this.startTime);

            window.requestAnimFrame(this.showProgress.bind(this));

            if (this.curDuration >= this.buffer.duration || this.curDuration >= this.endTime) {
                this.progressLine.attr('y2', 0);
                this.stop();
            }
        }
    }

    play() {
        this.playButton.attr('disabled', true);

        if (this.isLoaded) {
            this.volume.gain.value = 1;
            window.requestAnimFrame(this.showProgress.bind(this));
        }

        this.startTime = this.context.currentTime;
        this.count = 0;
        this.curSec = 0;
        this.curDuration = 0;

        // create a buffer source node
        this.source = this.context.createBufferSource();
        this.source.buffer = this.buffer;
        this.analyser.buffer = this.buffer;
        this.scriptNode.onaudioprocess = this.process.bind(this);

        // Connect graph
        this.source.connect(this.analyser);
        this.analyser.connect(this.scriptNode);

        this.analyser.connect(this.volume);
        this.volume.connect(this.context.destination);

        this.scriptNode.connect(this.context.destination);

        // include the zoom factor in the playback of the sound
        const startIndex = Math.floor((this.xScale.domain()[0] / this.timeRange[1]) * this.data.length) || 0;
        const endIndex = Math.floor((this.xScale.domain()[1] / this.timeRange[1]) * this.data.length) - 1 || this.data.length;
        let startTime = 0;
        this.endTime = this.timeRange[1];
        
        // set the time moments for the partial sound playback
        if (this.data[startIndex] && this.data[endIndex]) {
            startTime = this.data[startIndex].key;
            this.endTime = this.data[endIndex].key;
        }

        this.source.loop = false;
        this.source.start(0, startTime);
        this.isPlaying = true;
        
        // animate the progress line
        if (this.isLoaded) {
            this.progressLine
                .attr('x1', 0)
                .attr('x2', 0)
                .attr('y2', this.height)
                .transition()
                .ease(d3.easeLinear)
                .duration((this.endTime - startTime) * 1000)
                .attr('x1', this.width)
                .attr('x2', this.width)
                .attr('y2', this.height);
        }
    }

    pauseResume() {
        // pause the audio file
        if (this.isPlaying) {
            // pause also the progress line
            this.progressLine
                .transition()
                .duration(0);
            this.context.suspend().then(() => {
                this.pauseButton.text('Resume');
            });
            this.isPlaying = false;
        } 
        // resume
        else {
            // continue the progress line
            this.progressLine
                .transition()
                .ease(d3.easeLinear)
                .duration((this.endTime - this.curDuration) * 1000)
                .attr('x1', this.width)
                .attr('x2', this.width);

            this.context.resume().then(() => {
                this.pauseButton.text('Pause');
            });
            this.isPlaying = true;
            window.requestAnimFrame(this.showProgress.bind(this));
        }
    }

    stop() {
        // if paused - resume and stop
        if (this.context.state === 'suspended') {
            this.pauseButton.text('Pause');
            this.context.resume();
        }
        // stop and enable the play button
        this.source.stop(0);
        this.playButton.attr('disabled', null);
        // remove the progress line to 0
        window.cancelAnimationFrame(this.showProgress.bind(this));
        this.progressLine
            .transition()
            .duration(0)
            .attr('x1', 0)
            .attr('x2', 0)
            .attr('y2', this.height);
        this.isPlaying = false;
    }

    draw() {
        // remove spinner
        this.spinner.remove();

        const min = d3.min(this.data, d => d3.min(d.values));
        const max = d3.max(this.data, d => d3.max(d.values));
        this.zScale.domain([min + 20, max - 20]);

        // get the context from the canvas to draw on
        const visContext = d3.select(this.selector)
            .select('.vis_canvas')
            .node()
            .getContext('2d');

        this.svg.select('.x.axis').call(this.xAxis);
        this.svg.select('.y.axis').call(this.yAxis);

        visContext.clearRect(0, 0, this.width + this.margin.left, this.height);

        // slice the array - increases performance
        const startIndex = Math.floor((this.xScale.domain()[0] / this.timeRange[1]) * this.data.length) || 0;
        const endIndex = Math.floor((this.xScale.domain()[1] / this.timeRange[1]) * this.data.length) || this.data.length;

        let tmpData = this.data.slice(startIndex, endIndex);

        // bin the data into less number of elements - this is calculated if
        // the dotWidth would be less than 1
        let binnedTmpData = [];
        // if this is true each time slice would be smaller than 1
        // if true bin and average the array to the number of elements of width
        if ((endIndex - startIndex) > this.width) {
            const ratio = Math.ceil((endIndex - startIndex) / this.width);
            for (let i = 0; i < tmpData.length; i++) {
                if (!(i % ratio)) {
                    const tmpValues = [Array.from(tmpData[i].values)];
                    const tmpKey = [tmpData[i].key];
                    // get the i+ratio elements to compute the average of a bin in the next step
                    for (let j = i + 1; j < i + ratio; j++) {
                        if (tmpData[j]) {
                            tmpValues.push(Array.from(tmpData[j].values));
                            tmpKey.push(tmpData[j].key);
                        }
                    }
                    // average the columns in the 2D array and convert back to Uint8Array
                    const avgValues = new Uint8Array(tmpValues.reduce((acc, cur) => {
                        cur.forEach((e, i) => acc[i] = acc[i] ? acc[i] + e : e);
                        return acc;
                    }, []).map(e => e / tmpValues.length));
                    
                    // average of the time moment
                    const avgKey = tmpKey.reduce((a, b) => a + b) / tmpKey.length;

                    binnedTmpData.push({
                        'values': avgValues,
                        'key': avgKey
                    });
                }
            }
        } else {
            binnedTmpData = tmpData;
        }

        this.dotWidth = (this.width / binnedTmpData.length) + 1;
        this.dotHeight = (this.height / this.analyser.frequencyBinCount) * (this.freqRange[1] / this.yScale.domain()[1]) + 1;
        
        // draw only the zoomed part
        binnedTmpData.forEach(d => {
            for (let j = 0; j < d.values.length - 1; j++) {
                // draw each pixel with the specific color
                const v = d.values[j];
                const x = this.xScale(d.key);
                const y = this.yScale(this.getBinFrequency(j));
                // color scale
                visContext.fillStyle = this.zScale(v);
                // draw the line
                visContext.fillRect(x, y, this.dotWidth, this.dotHeight);
            }
        });
    }

    getFrequencyValue(freq) {
        const nyquist = this.context.sampleRate / 2;
        const index = Math.round(freq / nyquist * this.freqs.length);
        return this.freqs[index];
    }

    getBinFrequency(index) {
        const nyquist = this.context.sampleRate / 2;
        return index / this.freqs.length * nyquist;
    }
}

export default Spectrogram;
