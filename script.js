const serverURL = 'https://scam.danwand.in/api/check';

function analyzePage() {
    console.log("Starting analysis...");
    const pageData = {
        url: window.location.href,
        content: document.body.innerText,

    };
    showLoadingBar();

    fetch(serverURL,{
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',

        },
        body: JSON.stringify(pageData),

    })  
        .then(response => response.json())
        .then(data => {
            removeLoadingBar();
            if(data.scamProbability > 50) {
                floodPageWithRed();
                showAlertBar(data.scamProbability);

            }else {
                showSafeBar(data.scamProbability);
            }
        })
        .catch(error => {
            console.error('Error analyzing page:',error);
            removeLoadingBar();
            showErrorBar();
        });
}

function showLoadingBar() {
    const loadingBar = document.createElemnet('div');
    loadingBar.id = 'scam-detector-loading';
    loadingBar.innerText ='Analyzing..';
    loadingBar.style ='position:fixed;top:0;width:100%;background:yellow;text-align:center;z-index:10000;padding:10px;';
    document.body.appendChild(loadingBar);

}

function removeLoadingBar() {
    const loadingBar = document.getElementById('scam-detector-loading');
    if (loadingBar){
        document.body.removeChild(loadingBar);
    }
}

function floodPageWithRed() {
    const floodDiv = document.createElement('div');
    floodDiv.id = 'scam-detector-flood';
    floodDiv.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:red;opacity:0.5;z-index:9999;pointer-events:none;';
    document.body.appendChild(floodDiv);
}

function showAlertBar(probability) {
    const alertBar = document.createElement('div');
    alertBar.id = 'scam-detector-alert';
    alertBar.innerHTML =`<strong>Warning:</strong> This page has a ${probability}% chance of being a scam. <button id='scam-ignore-button'>Ignore</button>`;
    alertBar.style =  'position:fixed;top:0;width:100%;background:red;color:white;text-align:center;z-index:10001;padding:10px;';
    document.body.appendChild(alertBar);

    document.getElementById('scam-ignore-button').addEventListener('click',() => {
        removeFlood();
        document.getElementById('scam-detector-alert').remove();
    });
}

function showSafeBar(probability){
    const safeBar = document.createElement('div');
    safeBar.id = 'scam-detector-safe';
    safeBar.innerHTML = `This page has a ${probability}% chance of being safe.`;
    safeBar.style = 'position:fixed;top:0;width:100%;background:green;color:white;text-align:center;z-index:10000;padding:10px;';
    document.body.appendChild(safeBar);

    setTimeout(() => {
        if (safeBar )safeBar.remove()
        
    },5000);
}

function showErrorBar() {
    const errorBar = document.createElement('div');
    errorBar.id = 'scam-detector-error';
    errorBar.innerText = 'Error analyzing page. Please try again later.';
    errorBar.style = 'position:fixed;top:0;width:100%;background:orange;color:black;text-align:center;z-index:10000;padding:10px;';
    document.body.appendChild(errorBar);
    setTimeout(() => {
        if (errorBar) errorBar.remove();
    }, 5000);


}

function removeFlood() {
    const floodDiv = document.getElementById('scam-detector-flood');
    if (floodDiv) {
        document.body.removeChild(floodDiv);
    }
}


analyzePage();
